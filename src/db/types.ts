import type { ItemSource, ItemStatus } from "../constants";

export type ItemRow = {
  id: string;
  url: string;
  title: string | null;
  content_extract: string | null;
  summary: string | null;
  embedding: Uint8Array | null;
  source: ItemSource;
  source_context: string | null;
  captured_at: string;
  processed_at: string | null;
  status: ItemStatus;
};

export type ItemResponse = Omit<ItemRow, "embedding">;
