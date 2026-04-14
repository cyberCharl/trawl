import type { ItemSource, ItemStatus } from "../constants";

export type ItemRow = {
  id: string;
  url: string;
  title: string | null;
  content_extract: string | null;
  summary: string | null;
  embedding: Uint8Array | null;
  error_details: string | null;
  source: ItemSource;
  source_context: string | null;
  captured_at: string;
  last_seen_at: string;
  processed_at: string | null;
  status: ItemStatus;
  obsidian_note_id: string | null;
};

export type ItemResponse = Omit<ItemRow, "content_extract" | "embedding"> & {
  tags: string[];
};
