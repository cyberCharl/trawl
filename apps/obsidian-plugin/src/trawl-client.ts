import { requestUrl } from "obsidian";

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

type HealthResponse = {
  status: string;
};

type ItemEnvelope = {
  item: TrawlItem;
};

type ListItemsResponse = {
  items: TrawlItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
};

export type TrawlClientSettings = {
  apiUrl: string;
  apiKey: string;
};

export class TrawlClient {
  constructor(private readonly getSettings: () => TrawlClientSettings) {}

  private getBaseUrl(): string {
    const { apiUrl } = this.getSettings();
    const normalized = apiUrl.trim().replace(/\/$/, "");

    if (!normalized) {
      throw new Error("Set the Trawl API URL in plugin settings.");
    }

    return normalized;
  }

  private getHeaders(): Record<string, string> {
    const { apiKey } = this.getSettings();

    if (!apiKey.trim()) {
      throw new Error("Set the Trawl API key in plugin settings.");
    }

    return {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    };
  }

  private buildUrl(path: string, searchParams?: URLSearchParams): string {
    const url = new URL(path, `${this.getBaseUrl()}/`);

    if (searchParams) {
      url.search = searchParams.toString();
    }

    return url.toString();
  }

  async health(): Promise<HealthResponse> {
    const response = await requestUrl({
      url: this.buildUrl("health"),
      method: "GET",
    });

    return response.json as HealthResponse;
  }

  async listItems(params: {
    status?: ItemStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<ListItemsResponse> {
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

    const response = await requestUrl({
      url: this.buildUrl("items", searchParams),
      method: "GET",
      headers: this.getHeaders(),
    });

    return response.json as ListItemsResponse;
  }

  async getItem(itemId: string): Promise<ItemEnvelope> {
    const response = await requestUrl({
      url: this.buildUrl(`items/${itemId}`),
      method: "GET",
      headers: this.getHeaders(),
    });

    return response.json as ItemEnvelope;
  }

  async updateItem(
    itemId: string,
    body: {
      status?: ItemStatus;
      tags?: string[];
      source_context?: string | null;
      obsidian_note_id?: string | null;
    },
  ): Promise<ItemEnvelope> {
    const response = await requestUrl({
      url: this.buildUrl(`items/${itemId}`),
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return response.json as ItemEnvelope;
  }

  async processItem(itemId: string): Promise<ItemEnvelope> {
    const response = await requestUrl({
      url: this.buildUrl(`items/${itemId}/process`),
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    });

    return response.json as ItemEnvelope;
  }
}
