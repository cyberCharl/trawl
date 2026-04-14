import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";
import { load as loadSqliteVec } from "sqlite-vec";

import { config } from "../config";
import { schemaStatements } from "./schema";

function ensureDatabaseDirectory(dbPath: string): void {
  const directory = dirname(dbPath);

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function loadSqliteVecExtension(db: Database): void {
  loadSqliteVec(db);
}

function columnExists(db: Database, tableName: string, columnName: string): boolean {
  const columns = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function runMigrations(db: Database): void {
  if (!columnExists(db, "items", "error_details")) {
    db.run("ALTER TABLE items ADD COLUMN error_details TEXT");
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

  return db;
}

export const db = initializeDatabase();
