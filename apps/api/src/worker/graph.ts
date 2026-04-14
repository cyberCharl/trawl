import { db } from "../db/client";

type SimilarItemRow = {
  id: string;
  distance: number;
};

type SharedTagRow = {
  item_id: string;
};

const deleteAutoEdgesStatement = db.prepare(
  `
    DELETE FROM edges
    WHERE edge_type IN ('semantic_similarity', 'shared_tag')
      AND (source_item_id = ? OR target_item_id = ?)
  `,
);

const selectSimilarItemsStatement = db.prepare(
  `
    SELECT
      id,
      vec_distance_cosine(embedding, ?) AS distance
    FROM items
    WHERE status = 'processed'
      AND embedding IS NOT NULL
      AND id != ?
    ORDER BY distance ASC
  `,
);

const selectSharedTagItemsStatement = db.prepare(
  `
    SELECT DISTINCT other.item_id
    FROM item_tags AS current
    INNER JOIN item_tags AS other
      ON other.tag_id = current.tag_id
    WHERE current.item_id = ?
      AND other.item_id != ?
  `,
);

const upsertEdgeStatement = db.prepare(
  `
    INSERT INTO edges (
      source_item_id,
      target_item_id,
      edge_type,
      weight
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(source_item_id, target_item_id, edge_type)
    DO UPDATE SET weight = excluded.weight
  `,
);

const rebuildGraphTransaction = db.transaction(
  (
    itemId: string,
    embedding: Uint8Array,
    similarityThreshold: number,
  ) => {
    deleteAutoEdgesStatement.run(itemId, itemId);

    const similarItems = selectSimilarItemsStatement.all(embedding, itemId) as SimilarItemRow[];

    for (const similarItem of similarItems) {
      if (typeof similarItem.distance !== "number") {
        continue;
      }

      const similarity = 1 - similarItem.distance;

      if (similarity < similarityThreshold) {
        continue;
      }

      upsertEdgeStatement.run(itemId, similarItem.id, "semantic_similarity", similarity);
      upsertEdgeStatement.run(similarItem.id, itemId, "semantic_similarity", similarity);
    }

    const sharedTagItems = selectSharedTagItemsStatement.all(itemId, itemId) as SharedTagRow[];

    for (const sharedTagItem of sharedTagItems) {
      upsertEdgeStatement.run(itemId, sharedTagItem.item_id, "shared_tag", 1);
      upsertEdgeStatement.run(sharedTagItem.item_id, itemId, "shared_tag", 1);
    }
  },
);

export function rebuildGraphEdges(params: {
  itemId: string;
  embedding: Uint8Array;
  similarityThreshold: number;
}): void {
  rebuildGraphTransaction(params.itemId, params.embedding, params.similarityThreshold);
}
