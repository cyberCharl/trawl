import { Hono } from "hono";

import { ITEM_SOURCES } from "../constants";
import {
  createPendingItem,
  findItemByUrl,
  resetFailedItemToPending,
  touchExistingItem,
} from "../db/items";
import { captureQueue } from "../queue";

type CreateItemBody = {
  url?: unknown;
  source?: unknown;
  source_context?: unknown;
};

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

export const itemRoutes = new Hono();

itemRoutes.post("/", async (c) => {
  let body: CreateItemBody;

  try {
    body = await c.req.json<CreateItemBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.url !== "string" || !isValidCaptureUrl(body.url)) {
    return c.json({ error: "url must be a valid http/https URL" }, 400);
  }

  const source = body.source ?? "api";

  if (!isItemSource(source)) {
    return c.json({ error: "source must be one of: extension, telegram-user, telegram-agent, api, agent" }, 400);
  }

  if (
    body.source_context !== undefined &&
    body.source_context !== null &&
    typeof body.source_context !== "string"
  ) {
    return c.json({ error: "source_context must be a string when provided" }, 400);
  }

  const capturedAt = new Date().toISOString();
  const existingItem = findItemByUrl(body.url);

  if (existingItem) {
    if (existingItem.status === "failed") {
      resetFailedItemToPending(existingItem.id, capturedAt);
    } else {
      touchExistingItem(existingItem.id, capturedAt);
    }

    captureQueue.enqueue(existingItem.id);

    return c.json(
      {
        item: {
          ...existingItem,
          captured_at: capturedAt,
          error_details: existingItem.status === "failed" ? null : existingItem.error_details,
          status: existingItem.status === "failed" ? "pending" : existingItem.status,
        },
      },
      200,
    );
  }

  const item = createPendingItem({
    url: body.url,
    source,
    sourceContext: body.source_context ?? null,
    capturedAt,
  });

  captureQueue.enqueue(item.id);

  return c.json({ item }, 201);
});
