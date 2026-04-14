export type ItemStatus = "pending" | "processed" | "failed" | "archived";

export type TrawlItem = {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  error_details: string | null;
  source: "extension" | "web" | "api" | "agent";
  source_context: string | null;
  captured_at: string;
  last_seen_at: string;
  processed_at: string | null;
  status: ItemStatus;
  obsidian_note_id: string | null;
  tags: string[];
};

type Pagination = {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
};

type ListItemsResponse = {
  items: TrawlItem[];
  pagination: Pagination;
};

type BatchCaptureResponse = {
  results: Array<{
    url: string;
    created: boolean;
    item: TrawlItem;
  }>;
  errors: Array<{
    url: string;
    error: string;
  }>;
  summary: {
    received: number;
    created: number;
    duplicates: number;
    invalid: number;
  };
};

const DEFAULT_API_URL = "http://localhost:3100";

function getApiBaseUrl(): string {
  return process.env.TRAWL_API_URL ?? DEFAULT_API_URL;
}

function getApiKey(): string {
  const apiKey = process.env.TRAWL_API_KEY ?? process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Set TRAWL_API_KEY (or API_KEY) for the web app server environment.");
  }

  return apiKey;
}

async function trawlFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${getApiKey()}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(new URL(path, getApiBaseUrl()), {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export async function listItems(params: {
  status?: ItemStatus;
  limit?: number;
  offset?: number;
}): Promise<ListItemsResponse> {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const query = searchParams.toString();

  return trawlFetch<ListItemsResponse>(query ? `/items?${query}` : "/items");
}

export async function batchCapture(params: {
  urls: string[];
  source?: "web" | "api" | "extension" | "agent";
  sourceContext?: string | null;
}): Promise<BatchCaptureResponse> {
  return trawlFetch<BatchCaptureResponse>("/items/batch", {
    method: "POST",
    body: JSON.stringify({
      urls: params.urls,
      source: params.source ?? "web",
      source_context: params.sourceContext ?? null,
    }),
  });
}

export async function triggerProcessing(itemId: string): Promise<{ item: TrawlItem }> {
  return trawlFetch<{ item: TrawlItem }>(`/items/${itemId}/process`, {
    method: "POST",
  });
}
