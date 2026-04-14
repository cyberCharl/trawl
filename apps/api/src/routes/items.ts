import { Hono } from "hono";

import { ITEM_SOURCES, ITEM_STATUSES } from "../constants";
import {
  createPendingItem,
  findItemByUrl,
  getItemById,
  getPublicItemById,
  listItems,
  resetFailedItemToPending,
  touchExistingItem,
  updateItemById,
} from "../db/items";
import { captureQueue } from "../queue";

type CreateItemBody = {
  url?: unknown;
  source?: unknown;
  source_context?: unknown;
};

type BatchCreateItemsBody = {
  urls?: unknown;
  source?: unknown;
  source_context?: unknown;
};

type PatchItemBody = {
  status?: unknown;
  tags?: unknown;
  source_context?: unknown;
  obsidian_note_id?: unknown;
};

function normalizeUrl(value: string): string {
  return value.trim();
}

function isValidCaptureUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function isItemSource(value: unknown): value is (typeof ITEM_SOURCES)[number] {
  return typeof value === "string" && ITEM_SOURCES.includes(value as (typeof ITEM_SOURCES)[number]);
}

function isItemStatus(value: unknown): value is (typeof ITEM_STATUSES)[number] {
  return typeof value === "string" && ITEM_STATUSES.includes(value as (typeof ITEM_STATUSES)[number]);
}

function parsePaginationNumber(value: string | undefined, fallback: number, max: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function validateSourceContext(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("source_context must be a string when provided");
  }

  return value.trim() || null;
}

function validateTagList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("tags must be an array of strings when provided");
  }

  return Array.from(
    new Set(
      value
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  );
}

function validateObsidianNoteId(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("obsidian_note_id must be a string when provided");
  }

  return value.trim() || null;
}

function captureItem(params: {
  url: string;
  source: (typeof ITEM_SOURCES)[number];
  sourceContext: string | null;
}): { created: boolean; item: ReturnType<typeof createPendingItem> } {
  const now = new Date().toISOString();
  const existingItem = findItemByUrl(params.url);

  if (existingItem) {
    touchExistingItem(existingItem.id, now);

    const refreshedItem = getPublicItemById(existingItem.id);

    if (!refreshedItem) {
      throw new Error("Failed to fetch updated item");
    }

    return {
      created: false,
      item: refreshedItem,
    };
  }

  return {
    created: true,
    item: createPendingItem({
      url: params.url,
      source: params.source,
      sourceContext: params.sourceContext,
      capturedAt: now,
    }),
  };
}

export const itemRoutes = new Hono();

itemRoutes.get("/", (c) => {
  const status = c.req.query("status");

  if (status !== undefined && !isItemStatus(status)) {
    return c.json({ error: "status must be one of: pending, processed, failed, archived" }, 400);
  }

  const limit = parsePaginationNumber(c.req.query("limit"), 50, 100);
  const offset = parsePaginationNumber(c.req.query("offset"), 0, Number.MAX_SAFE_INTEGER);
  const result = listItems({
    status,
    limit,
    offset,
  });

  return c.json({
    items: result.items,
    pagination: {
      limit,
      offset,
      total: result.total,
      has_more: offset + result.items.length < result.total,
    },
  });
});

itemRoutes.post("/batch", async (c) => {
  let body: BatchCreateItemsBody;

  try {
    body = await c.req.json<BatchCreateItemsBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.urls)) {
    return c.json({ error: "urls must be an array of strings" }, 400);
  }

  const source = body.source ?? "web";

  if (!isItemSource(source)) {
    return c.json({ error: "source must be one of: extension, web, api, agent" }, 400);
  }

  let sourceContext: string | null;

  try {
    sourceContext = validateSourceContext(body.source_context) ?? null;
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid source_context" }, 400);
  }

  const results: Array<{ url: string; created: boolean; item: ReturnType<typeof createPendingItem> }> = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const rawUrl of body.urls) {
    if (typeof rawUrl !== "string") {
      errors.push({ url: String(rawUrl), error: "url must be a string" });
      continue;
    }

    const url = normalizeUrl(rawUrl);

    if (!isValidCaptureUrl(url)) {
      errors.push({ url, error: "url must be a valid http/https URL" });
      continue;
    }

    results.push({
      url,
      ...captureItem({
        url,
        source,
        sourceContext,
      }),
    });
  }

  return c.json(
    {
      results,
      errors,
      summary: {
        received: body.urls.length,
        created: results.filter((result) => result.created).length,
        duplicates: results.filter((result) => !result.created).length,
        invalid: errors.length,
      },
    },
    200,
  );
});

itemRoutes.post("/", async (c) => {
  let body: CreateItemBody;

  try {
    body = await c.req.json<CreateItemBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.url !== "string") {
    return c.json({ error: "url must be a valid http/https URL" }, 400);
  }

  const url = normalizeUrl(body.url);

  if (!isValidCaptureUrl(url)) {
    return c.json({ error: "url must be a valid http/https URL" }, 400);
  }

  const source = body.source ?? "api";

  if (!isItemSource(source)) {
    return c.json({ error: "source must be one of: extension, web, api, agent" }, 400);
  }

  let sourceContext: string | null;

  try {
    sourceContext = validateSourceContext(body.source_context) ?? null;
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid source_context" }, 400);
  }

  const result = captureItem({
    url,
    source,
    sourceContext,
  });

  return c.json(result, result.created ? 201 : 200);
});

itemRoutes.get("/:id", (c) => {
  const item = getPublicItemById(c.req.param("id"));

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json({ item });
});

itemRoutes.patch("/:id", async (c) => {
  let body: PatchItemBody;

  try {
    body = await c.req.json<PatchItemBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  let status: (typeof ITEM_STATUSES)[number] | undefined;
  let tags: string[] | undefined;
  let sourceContext: string | null | undefined;
  let obsidianNoteId: string | null | undefined;

  if (body.status !== undefined) {
    if (!isItemStatus(body.status)) {
      return c.json({ error: "status must be one of: pending, processed, failed, archived" }, 400);
    }

    status = body.status;
  }

  if (body.tags !== undefined) {
    try {
      tags = validateTagList(body.tags);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Invalid tags" }, 400);
    }
  }

  try {
    sourceContext = validateSourceContext(body.source_context);
    obsidianNoteId = validateObsidianNoteId(body.obsidian_note_id);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid patch body" }, 400);
  }

  if (
    status === undefined &&
    tags === undefined &&
    sourceContext === undefined &&
    obsidianNoteId === undefined
  ) {
    return c.json({ error: "No supported fields provided" }, 400);
  }

  const item = updateItemById({
    id: c.req.param("id"),
    status,
    tags,
    sourceContext,
    obsidianNoteId,
  });

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json({ item });
});

itemRoutes.post("/:id/process", (c) => {
  const itemId = c.req.param("id");
  const item = getItemById(itemId);

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  if (item.status === "processed") {
    return c.json({ error: "Item has already been processed" }, 409);
  }

  if (item.status === "archived") {
    return c.json({ error: "Archived items cannot be processed" }, 409);
  }

  if (item.status === "failed") {
    resetFailedItemToPending(itemId);
  }

  captureQueue.enqueue(itemId);

  const refreshedItem = getPublicItemById(itemId);

  if (!refreshedItem) {
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json({ item: refreshedItem }, 202);
});
