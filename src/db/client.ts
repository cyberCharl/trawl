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

  return db;
}

export const db = initializeDatabase();
