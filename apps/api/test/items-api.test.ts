import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "trawl-api-test-"));
const databasePath = join(tempDirectory, "trawl-api.sqlite");
const apiKey = "test-api-key";
const secondaryApiKey = "test-obsidian-key";

process.env.API_KEY = apiKey;
process.env.API_KEYS = secondaryApiKey;
process.env.DB_PATH = databasePath;
process.env.OLLAMA_URL = "http://localhost:11434";
process.env.SUMMARY_MODEL = "qwen3:8b";
process.env.TAGGING_MODEL = "qwen3:8b";
process.env.EMBEDDING_MODEL = "nomic-embed-text";
process.env.SIMILARITY_THRESHOLD = "0.75";

const { app } = await import("../src/app");
const { db } = await import("../src/db/client");

afterAll(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});

beforeEach(() => {
  db.run("DELETE FROM edges");
  db.run("DELETE FROM item_tags");
  db.run("DELETE FROM items");
  db.run("DELETE FROM tags");
});

async function apiRequest(
  path: string,
  init: RequestInit = {},
  token: string = apiKey,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return app.request(path, {
    ...init,
    headers,
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("items API", () => {
  test("keeps /health open and protects /items with bearer auth", async () => {
    const healthResponse = await app.request("/health");
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: "ok" });

    const unauthorizedResponse = await app.request("/items");
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({ error: "Unauthorized" });
  });

  test("accepts any configured bearer token", async () => {
    const response = await apiRequest(
      "/items",
      {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/secondary-token",
          source: "extension",
        }),
      },
      secondaryApiKey,
    );

    expect(response.status).toBe(201);
  });

  test("captures a new item with capture-only semantics", async () => {
    const response = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/research-note",
        source: "web",
        source_context: "browser cleanup",
      }),
    });

    expect(response.status).toBe(201);

    const payload = await json<{
      created: boolean;
      item: {
        id: string;
        url: string;
        status: string;
        source: string;
        source_context: string | null;
        captured_at: string;
        last_seen_at: string;
        processed_at: string | null;
        tags: string[];
      };
    }>(response);

    expect(payload.created).toBe(true);
    expect(payload.item.url).toBe("https://example.com/research-note");
    expect(payload.item.status).toBe("pending");
    expect(payload.item.source).toBe("web");
    expect(payload.item.source_context).toBe("browser cleanup");
    expect(payload.item.captured_at).toBe(payload.item.last_seen_at);
    expect(payload.item.processed_at).toBeNull();
    expect(payload.item.tags).toEqual([]);
    expect("content_extract" in payload.item).toBe(false);
  });

  test("deduplicates URL capture while preserving first-seen history and updating recency", async () => {
    const firstResponse = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/duplicate-target",
      }),
    });
    const firstPayload = await json<{
      created: boolean;
      item: {
        id: string;
        captured_at: string;
        last_seen_at: string;
      };
    }>(firstResponse);

    await wait(15);

    const secondResponse = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/duplicate-target",
      }),
    });
    expect(secondResponse.status).toBe(200);

    const secondPayload = await json<{
      created: boolean;
      item: {
        id: string;
        captured_at: string;
        last_seen_at: string;
      };
    }>(secondResponse);

    expect(secondPayload.created).toBe(false);
    expect(secondPayload.item.id).toBe(firstPayload.item.id);
    expect(secondPayload.item.captured_at).toBe(firstPayload.item.captured_at);
    expect(secondPayload.item.last_seen_at).not.toBe(firstPayload.item.last_seen_at);
    expect(secondPayload.item.last_seen_at > firstPayload.item.last_seen_at).toBe(true);

    const listResponse = await apiRequest("/items");
    const listPayload = await json<{
      items: Array<{
        id: string;
        captured_at: string;
        last_seen_at: string;
      }>;
      pagination: {
        total: number;
      };
    }>(listResponse);

    expect(listPayload.pagination.total).toBe(1);
    expect(listPayload.items[0]?.captured_at).toBe(firstPayload.item.captured_at);
    expect(listPayload.items[0]?.last_seen_at).toBe(secondPayload.item.last_seen_at);
  });

  test("supports batch capture, item patching, single-item retrieval, and status filtering", async () => {
    const batchResponse = await apiRequest("/items/batch", {
      method: "POST",
      body: JSON.stringify({
        urls: [
          "https://example.com/one",
          "https://example.com/two",
          "https://example.com/one",
          "notaurl",
        ],
        source: "web",
      }),
    });

    expect(batchResponse.status).toBe(200);

    const batchPayload = await json<{
      results: Array<{
        url: string;
        created: boolean;
        item: { id: string };
      }>;
      errors: Array<{ url: string; error: string }>;
      summary: {
        received: number;
        created: number;
        duplicates: number;
        invalid: number;
      };
    }>(batchResponse);

    expect(batchPayload.summary).toEqual({
      received: 4,
      created: 2,
      duplicates: 1,
      invalid: 1,
    });
    expect(batchPayload.errors).toEqual([
      { url: "notaurl", error: "url must be a valid http/https URL" },
    ]);

    const firstItemId = batchPayload.results[0]?.item.id;
    expect(firstItemId).toBeDefined();

    const patchResponse = await apiRequest(`/items/${firstItemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "archived",
        tags: ["Research", "capture-flow", "research"],
        source_context: "weekly review",
        obsidian_note_id: "source-123",
      }),
    });

    expect(patchResponse.status).toBe(200);

    const patchedPayload = await json<{
      item: {
        id: string;
        status: string;
        tags: string[];
        source_context: string | null;
        obsidian_note_id: string | null;
      };
    }>(patchResponse);

    expect(patchedPayload.item.status).toBe("archived");
    expect(patchedPayload.item.tags).toEqual(["capture-flow", "research"]);
    expect(patchedPayload.item.source_context).toBe("weekly review");
    expect(patchedPayload.item.obsidian_note_id).toBe("source-123");

    const getResponse = await apiRequest(`/items/${firstItemId}`);
    expect(getResponse.status).toBe(200);
    const getPayload = await json<typeof patchedPayload>(getResponse);
    expect(getPayload.item).toEqual(patchedPayload.item);

    const filteredListResponse = await apiRequest("/items?status=archived");
    expect(filteredListResponse.status).toBe(200);
    const filteredPayload = await json<{
      items: Array<{ id: string; status: string }>;
      pagination: { total: number };
    }>(filteredListResponse);

    expect(filteredPayload.pagination.total).toBe(1);
    expect(filteredPayload.items).toHaveLength(1);
    expect(filteredPayload.items[0]?.id).toBe(firstItemId);
    expect(filteredPayload.items[0]?.status).toBe("archived");
  });

  test("only queues deliberate processing and enforces process status rules", async () => {
    const createResponse = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/process-me",
      }),
    });
    const createPayload = await json<{ item: { id: string } }>(createResponse);
    const itemId = createPayload.item.id;

    const markFailedResponse = await apiRequest(`/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
      }),
    });
    expect(markFailedResponse.status).toBe(200);

    const processResponse = await apiRequest(`/items/${itemId}/process`, {
      method: "POST",
    });
    expect(processResponse.status).toBe(202);

    const processPayload = await json<{
      item: {
        id: string;
        status: string;
        processed_at: string | null;
      };
    }>(processResponse);

    expect(processPayload.item.id).toBe(itemId);
    expect(processPayload.item.status).toBe("pending");
    expect(processPayload.item.processed_at).toBeNull();

    const processedItemResponse = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/already-processed",
      }),
    });
    const processedItemPayload = await json<{ item: { id: string } }>(processedItemResponse);

    await apiRequest(`/items/${processedItemPayload.item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "processed",
      }),
    });

    const processedConflictResponse = await apiRequest(
      `/items/${processedItemPayload.item.id}/process`,
      {
        method: "POST",
      },
    );
    expect(processedConflictResponse.status).toBe(409);
    expect(await processedConflictResponse.json()).toEqual({
      error: "Item has already been processed",
    });

    const archivedItemResponse = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/archived-item",
      }),
    });
    const archivedItemPayload = await json<{ item: { id: string } }>(archivedItemResponse);

    await apiRequest(`/items/${archivedItemPayload.item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "archived",
      }),
    });

    const archivedConflictResponse = await apiRequest(
      `/items/${archivedItemPayload.item.id}/process`,
      {
        method: "POST",
      },
    );
    expect(archivedConflictResponse.status).toBe(409);
    expect(await archivedConflictResponse.json()).toEqual({
      error: "Archived items cannot be processed",
    });
  });
});
