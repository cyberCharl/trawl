export const ITEM_SOURCES = ["extension", "web", "api", "agent"] as const;

export const ITEM_STATUSES = ["pending", "processed", "failed", "archived"] as const;

export const EDGE_TYPES = ["semantic_similarity", "shared_tag", "manual"] as const;

export type ItemSource = (typeof ITEM_SOURCES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];
