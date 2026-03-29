export const schemaStatements = [
  "PRAGMA foreign_keys = ON",
  "PRAGMA journal_mode = WAL",
  `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      content_extract TEXT,
      summary TEXT,
      embedding BLOB,
      error_details TEXT,
      source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('extension', 'telegram-user', 'telegram-agent', 'api', 'agent')),
      source_context TEXT,
      captured_at TEXT NOT NULL,
      processed_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'archived'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS edges (
      source_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      target_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      edge_type TEXT NOT NULL CHECK (edge_type IN ('semantic_similarity', 'shared_tag', 'manual')),
      weight REAL NOT NULL,
      PRIMARY KEY (source_item_id, target_item_id, edge_type)
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)",
  "CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id)",
  "CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id)",
  "CREATE INDEX IF NOT EXISTS idx_edges_target_item_id ON edges(target_item_id)",
] as const;
