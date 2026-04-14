import { nanoid } from "nanoid";

import type { ItemSource, ItemStatus } from "../constants";
import { db } from "./client";
import type { ItemResponse, ItemRow } from "./types";

type TagRow = {
  id: number;
  slug: string;
};

type CountRow = {
  total: number;
};

const ITEM_COLUMNS = `
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
`;

const selectItemByUrlStatement = db.prepare(`
  SELECT ${ITEM_COLUMNS}
  FROM items
  WHERE url = ?
`);

const selectItemByIdStatement = db.prepare(`
  SELECT ${ITEM_COLUMNS}
  FROM items
  WHERE id = ?
`);

const insertItemStatement = db.prepare(`
  INSERT INTO items (
    id,
    url,
    source,
    source_context,
    captured_at,
    last_seen_at,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
`);

const updateLastSeenStatement = db.prepare(`
  UPDATE items
  SET last_seen_at = ?
  WHERE id = ?
`);

const resetFailedItemStatement = db.prepare(`
  UPDATE items
  SET
    processed_at = NULL,
    status = 'pending',
    error_details = NULL
  WHERE id = ?
`);

const updateExtractedContentStatement = db.prepare(`
  UPDATE items
  SET
    title = ?,
    content_extract = ?
  WHERE id = ?
`);

const updateSummaryStatement = db.prepare(`
  UPDATE items
  SET summary = ?
  WHERE id = ?
`);

const markProcessedStatement = db.prepare(`
  UPDATE items
  SET
    status = 'processed',
    processed_at = ?,
    error_details = NULL
  WHERE id = ?
`);

const markFailedStatement = db.prepare(`
  UPDATE items
  SET
    status = 'failed',
    processed_at = NULL,
    error_details = ?
  WHERE id = ?
`);

const selectAllTagSlugsStatement = db.prepare(`
  SELECT slug
  FROM tags
  ORDER BY slug ASC
`);

const selectItemTagsStatement = db.prepare(`
  SELECT tags.slug AS slug
  FROM item_tags
  INNER JOIN tags ON tags.id = item_tags.tag_id
  WHERE item_tags.item_id = ?
  ORDER BY tags.slug ASC
`);

const insertTagStatement = db.prepare(`
  INSERT INTO tags (name, slug)
  VALUES (?, ?)
  ON CONFLICT(slug) DO NOTHING
`);

const selectTagBySlugStatement = db.prepare(`
  SELECT id, slug
  FROM tags
  WHERE slug = ?
`);

const deleteItemTagsStatement = db.prepare(`
  DELETE FROM item_tags
  WHERE item_id = ?
`);

const insertItemTagStatement = db.prepare(`
  INSERT OR IGNORE INTO item_tags (item_id, tag_id)
  VALUES (?, ?)
`);

function getItemTags(itemId: string): string[] {
  const rows = selectItemTagsStatement.all(itemId) as Array<{ slug: string }>;
  return rows.map((row) => row.slug);
}

function toItemResponse(item: ItemRow): ItemResponse {
  const { content_extract, embedding, ...response } = item;
  void content_extract;
  void embedding;

  return {
    ...response,
    tags: getItemTags(item.id),
  };
}

export function findItemByUrl(url: string): ItemResponse | null {
  const item = (selectItemByUrlStatement.get(url) as ItemRow | undefined) ?? null;
  return item ? toItemResponse(item) : null;
}

export function getItemById(id: string): ItemRow | null {
  return (selectItemByIdStatement.get(id) as ItemRow | undefined) ?? null;
}

export function getPublicItemById(id: string): ItemResponse | null {
  const item = getItemById(id);
  return item ? toItemResponse(item) : null;
}

export function createPendingItem(params: {
  url: string;
  source: ItemSource;
  sourceContext: string | null;
  capturedAt: string;
}): ItemResponse {
  const id = nanoid();

  insertItemStatement.run(
    id,
    params.url,
    params.source,
    params.sourceContext,
    params.capturedAt,
    params.capturedAt,
  );

  const item = getPublicItemById(id);

  if (!item) {
    throw new Error("Failed to fetch newly created item");
  }

  return item;
}

export function touchExistingItem(id: string, lastSeenAt: string): void {
  updateLastSeenStatement.run(lastSeenAt, id);
}

export function resetFailedItemToPending(id: string): void {
  resetFailedItemStatement.run(id);
}

export function listItems(params: {
  status?: ItemStatus;
  limit: number;
  offset: number;
}): { items: ItemResponse[]; total: number } {
  const whereClause = params.status ? "WHERE status = ?" : "";
  const sql = `
    SELECT ${ITEM_COLUMNS}
    FROM items
    ${whereClause}
    ORDER BY last_seen_at DESC, captured_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const countSql = `
    SELECT COUNT(*) AS total
    FROM items
    ${whereClause}
  `;
  const statement = db.query(sql);
  const countStatement = db.query(countSql);
  const queryParams = params.status
    ? [params.status, params.limit, params.offset]
    : [params.limit, params.offset];
  const countParams = params.status ? [params.status] : [];
  const rows = statement.all(...queryParams) as ItemRow[];
  const totalRow = countStatement.get(...countParams) as CountRow | undefined;

  return {
    items: rows.map((row) => toItemResponse(row)),
    total: totalRow?.total ?? 0,
  };
}

export function saveExtractedContent(
  itemId: string,
  title: string | null,
  contentExtract: string,
): void {
  updateExtractedContentStatement.run(title, contentExtract, itemId);
}

export function saveSummary(itemId: string, summary: string): void {
  updateSummaryStatement.run(summary, itemId);
}

export function markItemProcessed(itemId: string, processedAt: string): void {
  markProcessedStatement.run(processedAt, itemId);
}

export function markItemFailed(itemId: string, errorDetails: string): void {
  markFailedStatement.run(errorDetails, itemId);
}

export function listTagTaxonomy(): string[] {
  const rows = selectAllTagSlugsStatement.all() as Array<{ slug: string }>;
  return rows.map((row) => row.slug);
}

const replaceItemTagsTransaction = db.transaction((itemId: string, tagSlugs: string[]) => {
  deleteItemTagsStatement.run(itemId);

  for (const slug of tagSlugs) {
    insertTagStatement.run(slug, slug);

    const tag = selectTagBySlugStatement.get(slug) as TagRow | undefined;

    if (!tag) {
      throw new Error(`Failed to upsert tag: ${slug}`);
    }

    insertItemTagStatement.run(itemId, tag.id);
  }
});

export function replaceItemTags(itemId: string, tagSlugs: string[]): void {
  replaceItemTagsTransaction(itemId, Array.from(new Set(tagSlugs)));
}

export function updateItemById(params: {
  id: string;
  status?: ItemStatus;
  sourceContext?: string | null;
  obsidianNoteId?: string | null;
  tags?: string[];
}): ItemResponse | null {
  const currentItem = getItemById(params.id);

  if (!currentItem) {
    return null;
  }

  const assignments: string[] = [];
  const values: Array<string | null> = [];

  if (params.status !== undefined) {
    assignments.push("status = ?");
    values.push(params.status);

    if (params.status === "processed") {
      assignments.push("processed_at = ?");
      values.push(currentItem.processed_at ?? new Date().toISOString());
      assignments.push("error_details = NULL");
    } else if (params.status === "pending") {
      assignments.push("processed_at = NULL");
      assignments.push("error_details = NULL");
    } else if (params.status === "failed") {
      assignments.push("processed_at = NULL");
    }
  }

  if (params.sourceContext !== undefined) {
    assignments.push("source_context = ?");
    values.push(params.sourceContext);
  }

  if (params.obsidianNoteId !== undefined) {
    assignments.push("obsidian_note_id = ?");
    values.push(params.obsidianNoteId);
  }

  if (assignments.length > 0) {
    db.query(`UPDATE items SET ${assignments.join(", ")} WHERE id = ?`).run(...values, params.id);
  }

  if (params.tags !== undefined) {
    replaceItemTags(params.id, params.tags);
  }

  return getPublicItemById(params.id);
}
