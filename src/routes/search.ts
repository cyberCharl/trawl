import { Hono } from "hono";

import { searchItemsByEmbedding, searchItemsByText } from "../db/items";
import type { SearchResult } from "../db/types";
import { generateQueryEmbedding } from "../worker/embedder";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_SEMANTIC_QUERY_LENGTH = 3;

function parseLimit(value: string | undefined): number {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new Error("limit must be an integer between 1 and 100");
  }

  return parsed;
}

function mergeSearchResults(
  semanticResults: SearchResult[],
  textResults: ReturnType<typeof searchItemsByText>,
  limit: number,
): SearchResult[] {
  const merged = new Map<string, SearchResult>();

  for (const result of semanticResults) {
    merged.set(result.id, result);
  }

  for (const result of textResults) {
    if (merged.has(result.id)) {
      continue;
    }

    merged.set(result.id, {
      ...result,
      similarity: 0,
    });
  }

  return Array.from(merged.values()).slice(0, limit);
}

export const searchRoutes = new Hono();

searchRoutes.get("/", async (c) => {
  const query = c.req.query("q")?.trim();

  if (!query) {
    return c.json({ error: "q is required" }, 400);
  }

  let limit: number;

  try {
    limit = parseLimit(c.req.query("limit"));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid limit" }, 400);
  }

  const textResults = searchItemsByText(query, limit);

  if (query.length < MIN_SEMANTIC_QUERY_LENGTH) {
    return c.json({
      results: textResults.map((result) => ({
        ...result,
        similarity: 0,
      })),
    });
  }

  try {
    const queryEmbedding = await generateQueryEmbedding(query);
    const semanticResults = searchItemsByEmbedding(queryEmbedding, limit);

    return c.json({
      results: mergeSearchResults(semanticResults, textResults, limit),
    });
  } catch {
    return c.json({
      results: textResults.map((result) => ({
        ...result,
        similarity: 0,
      })),
    });
  }
});
