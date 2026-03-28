import { nanoid } from "nanoid";

import type { ItemSource } from "../constants";
import { db } from "./client";
import type { ItemResponse, ItemRow } from "./types";

const selectItemByUrlStatement = db.prepare(
  `
    SELECT
      id,
      url,
      title,
      content_extract,
      summary,
      embedding,
      source,
      source_context,
      captured_at,
      processed_at,
      status
    FROM items
    WHERE url = ?
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
