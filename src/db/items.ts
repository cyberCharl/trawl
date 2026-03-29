import { nanoid } from "nanoid";

import type { ItemSource } from "../constants";
import { db } from "./client";
import type { ItemResponse, ItemRow } from "./types";

type TagRow = {
  id: number;
  slug: string;
};

const selectItemByUrlStatement = db.prepare(
  `
    SELECT
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
      processed_at,
      status
    FROM items
    WHERE url = ?
  `,
);

const selectItemByIdStatement = db.prepare(
  `
    SELECT
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
      processed_at,
      status
    FROM items
    WHERE id = ?
  `,
);

const selectPendingItemIdsStatement = db.prepare(
  `
    SELECT id
    FROM items
    WHERE status = 'pending'
    ORDER BY captured_at ASC
  `,
);

const insertItemStatement = db.prepare(
  `
    INSERT INTO items (
      id,
      url,
      source,
      source_context,
      captured_at,
      status
    ) VALUES (?, ?, ?, ?, ?, 'pending')
  `,
);

const updateCapturedAtStatement = db.prepare(
  `
    UPDATE items
    SET captured_at = ?
    WHERE id = ?
  `,
);

const resetFailedItemStatement = db.prepare(
  `
    UPDATE items
    SET
      captured_at = ?,
      processed_at = NULL,
      status = 'pending',
      error_details = NULL
    WHERE id = ?
  `,
);

const updateExtractedContentStatement = db.prepare(
  `
    UPDATE items
    SET
      title = ?,
      content_extract = ?
    WHERE id = ?
  `,
);

const updateSummaryStatement = db.prepare(
  `
    UPDATE items
    SET summary = ?
    WHERE id = ?
  `,
);

const updateEmbeddingStatement = db.prepare(
  `
    UPDATE items
    SET embedding = ?
    WHERE id = ?
  `,
);

const markProcessedStatement = db.prepare(
  `
    UPDATE items
    SET
      status = 'processed',
      processed_at = ?,
      error_details = NULL
    WHERE id = ?
  `,
);

const markFailedStatement = db.prepare(
  `
    UPDATE items
    SET
      status = 'failed',
      processed_at = NULL,
      error_details = ?
    WHERE id = ?
  `,
);

const selectAllTagSlugsStatement = db.prepare(
  `
    SELECT slug
    FROM tags
    ORDER BY slug ASC
  `,
);

const insertTagStatement = db.prepare(
  `
    INSERT INTO tags (name, slug)
    VALUES (?, ?)
    ON CONFLICT(slug) DO NOTHING
  `,
);

const selectTagBySlugStatement = db.prepare(
  `
    SELECT id, slug
    FROM tags
    WHERE slug = ?
  `,
);

const deleteItemTagsStatement = db.prepare(
  `
    DELETE FROM item_tags
    WHERE item_id = ?
  `,
);

const insertItemTagStatement = db.prepare(
  `
    INSERT OR IGNORE INTO item_tags (item_id, tag_id)
    VALUES (?, ?)
  `,
);

function toItemResponse(item: ItemRow): ItemResponse {
  const { embedding: _embedding, ...response } = item;
  return response;
}

export function findItemByUrl(url: string): ItemResponse | null {
  const item = (selectItemByUrlStatement.get(url) as ItemRow | undefined) ?? null;
  return item ? toItemResponse(item) : null;
}

export function touchExistingItem(id: string, capturedAt: string): void {
  updateCapturedAtStatement.run(capturedAt, id);
}

export function resetFailedItemToPending(id: string, capturedAt: string): void {
  resetFailedItemStatement.run(capturedAt, id);
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
  );

  const item = selectItemByUrlStatement.get(params.url) as ItemRow | undefined;

  if (!item) {
    throw new Error("Failed to fetch newly created item");
  }

  return toItemResponse(item);
}

export function getItemById(id: string): ItemRow | null {
  return (selectItemByIdStatement.get(id) as ItemRow | undefined) ?? null;
}

export function listPendingItemIds(): string[] {
  const rows = selectPendingItemIdsStatement.all() as Array<{ id: string }>;
  return rows.map((row) => row.id);
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

export function saveEmbedding(itemId: string, embedding: Uint8Array): void {
  updateEmbeddingStatement.run(embedding, itemId);
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
  replaceItemTagsTransaction(itemId, tagSlugs);
}
