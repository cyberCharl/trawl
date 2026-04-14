import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";
import { load as loadSqliteVec } from "sqlite-vec";

import { config } from "../config";
import {
  edgesTableStatement,
  indexStatements,
  itemTagsTableStatement,
  itemsTableStatement,
  schemaStatements,
} from "./schema";

type TableInfoRow = {
  name: string;
};

type TableSqlRow = {
  sql: string | null;
};

type ItemTagLinkRow = {
  item_id: string;
  tag_id: number;
};

function ensureDatabaseDirectory(dbPath: string): void {
  const directory = dirname(dbPath);

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

let hasWarnedAboutSqliteVec = false;

function loadSqliteVecExtension(db: Database): void {
  try {
    loadSqliteVec(db);
  } catch (error) {
    if (hasWarnedAboutSqliteVec) {
      return;
    }

    hasWarnedAboutSqliteVec = true;

    const details = error instanceof Error ? error.message : String(error);
    console.warn(`sqlite-vec extension unavailable; continuing without it: ${details}`);
  }
}

function columnExists(db: Database, tableName: string, columnName: string): boolean {
  const columns = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function tableExists(db: Database, tableName: string): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as TableInfoRow | undefined;

  return Boolean(row?.name);
}

function getTableSql(db: Database, tableName: string): string {
  const row = db
    .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as TableSqlRow | undefined;

  return row?.sql ?? "";
}

function needsItemsTableMigration(db: Database): boolean {
  if (!tableExists(db, "items")) {
    return false;
  }

  const sql = getTableSql(db, "items").toLowerCase();

  return (
    !sql.includes("last_seen_at") ||
    !sql.includes("obsidian_note_id") ||
    !sql.includes("'web'")
  );
}

function migrateItemsTable(db: Database): void {
  const hasLastSeenAt = columnExists(db, "items", "last_seen_at");
  const hasObsidianNoteId = columnExists(db, "items", "obsidian_note_id");
  const hasErrorDetails = columnExists(db, "items", "error_details");
  const hasEmbedding = columnExists(db, "items", "embedding");
  const itemTags = tableExists(db, "item_tags")
    ? (db.query("SELECT item_id, tag_id FROM item_tags").all() as ItemTagLinkRow[])
    : [];

  db.run("PRAGMA foreign_keys = OFF");

  if (tableExists(db, "item_tags")) {
    db.run("DROP TABLE item_tags");
  }

  if (tableExists(db, "edges")) {
    db.run("DROP TABLE edges");
  }

  db.run("ALTER TABLE items RENAME TO items_legacy");
  db.run(itemsTableStatement);

  const lastSeenExpression = hasLastSeenAt ? "COALESCE(last_seen_at, captured_at)" : "captured_at";
  const obsidianNoteIdExpression = hasObsidianNoteId ? "obsidian_note_id" : "NULL";
  const errorDetailsExpression = hasErrorDetails ? "error_details" : "NULL";
  const embeddingExpression = hasEmbedding ? "embedding" : "NULL";

  db.run(`
    INSERT INTO items (
      id,
      url,
      title,
      content_extract,
      summary,
      embedding,
      error_details,
      source,
      source_context,
      captured_at,
      last_seen_at,
      processed_at,
      status,
      obsidian_note_id
    )
    SELECT
      id,
      url,
      title,
      content_extract,
      summary,
      ${embeddingExpression},
      ${errorDetailsExpression},
      CASE
        WHEN source IN ('extension', 'web', 'api', 'agent') THEN source
        WHEN source = 'telegram-agent' THEN 'agent'
        ELSE 'api'
      END,
      source_context,
      captured_at,
      ${lastSeenExpression},
      processed_at,
      status,
      ${obsidianNoteIdExpression}
    FROM items_legacy
  `);

  db.run("DROP TABLE items_legacy");
  db.run(itemTagsTableStatement);
  db.run(edgesTableStatement);

  const insertItemTagStatement = db.prepare(
    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)",
  );

  for (const itemTag of itemTags) {
    insertItemTagStatement.run(itemTag.item_id, itemTag.tag_id);
  }

  for (const statement of indexStatements) {
    db.run(statement);
  }

  db.run("PRAGMA foreign_keys = ON");
}

function runMigrations(db: Database): void {
  if (needsItemsTableMigration(db)) {
    migrateItemsTable(db);
  }
}

function initializeDatabase(): Database {
  ensureDatabaseDirectory(config.dbPath);

  const db = new Database(config.dbPath, {
    create: true,
    readwrite: true,
    strict: true,
  });

  loadSqliteVecExtension(db);

  for (const statement of schemaStatements) {
    db.run(statement);
  }

  runMigrations(db);

  for (const statement of schemaStatements) {
    db.run(statement);
  }

  return db;
}

export const db = initializeDatabase();
