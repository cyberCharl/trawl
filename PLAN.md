# Processing Worker Plan

## Pipeline approach

1. Listen to queue
   - Add a worker bootstrap that subscribes to `captureQueue`.
   - On `item:queued`, fetch the item from SQLite and only process when `status === 'pending'`.
   - Keep an in-memory `Set` of active item IDs so duplicate queue events do not process the same item concurrently.

2. Fetch and extract content
   - Use Bun's `fetch()` with a timeout and a browser-like user agent.
   - Parse HTML with `linkedom` and extract readable article content with `@mozilla/readability`.
   - Fall back to document title plus body text when Readability cannot produce content.
   - Persist `title` and cleaned `content_extract` before downstream LLM calls.

3. Summarise
   - Call Ollama `POST /api/chat` with `SUMMARY_MODEL`.
   - Prompt for a tight 2-3 sentence summary with no markdown, no preamble, and no reasoning output.
   - Strip any accidental `<think>` blocks before saving.

4. Generate embedding
   - Call Ollama `POST /api/embed` with `EMBEDDING_MODEL`.
   - Convert the numeric embedding array into a `Float32Array`, then store its backing bytes in `items.embedding`.
   - Use `sqlite-vec`'s documented Bun binding pattern, which accepts float vectors as `Float32Array`/binary blobs and supports cosine distance queries over BLOB columns.

5. Auto-tag
   - Read the current tag taxonomy from `tags`.
   - Ask Ollama for 2-5 domain-oriented tags, preferring existing taxonomy entries and allowing new proposals when needed.
   - Include `source_context` in the prompt only for `telegram-agent` and `agent` items.
   - Normalize results into lowercase slugs, upsert new tags, and replace the item's `item_tags` rows atomically.

6. Build graph edges
   - Use `sqlite-vec` cosine distance over `items.embedding` to compare the current item against all other processed items.
   - Treat similarity as `1 - cosine_distance`, and create `semantic_similarity` edges when the score exceeds `SIMILARITY_THRESHOLD`.
   - Create `shared_tag` edges with weight `1.0` for all items that share one or more tags with the current item.
   - Rebuild auto-generated edges for the processed item on every successful run so reprocessing stays consistent.

7. Update status and emit events
   - Mark the item `processed` with `processed_at` on success.
   - On any failure, capture a bounded error string in `error_details`, set `status = 'failed'`, and emit `item:failed`.
   - Emit `item:processed` on success for future SSE consumption.

## Packages needed

- `@mozilla/readability`
- `linkedom`

Existing dependencies already cover:

- `bun:sqlite`
- `sqlite-vec`
- `hono`

## Integration points

- `src/queue.ts`
  - Extend queue event typings and emitter helpers for `item:processed` and `item:failed`.
  - Worker subscribes to `item:queued`.

- `src/db/`
  - Expand schema to include `error_details`.
  - Add startup migration logic because existing databases already exist.
  - Add repository helpers for loading a single item by ID, updating extracted fields, saving embeddings, syncing tags, marking failure/success, and rebuilding edges.

- `src/index.ts`
  - Initialize the worker during server startup so queue events are handled as soon as the API boots.

- `src/config.ts` and `.env.example`
  - Add Ollama URL/model configuration and similarity threshold parsing.

## Failure handling

- Each queued item is processed inside a single `try/catch`.
- Fetch, summarisation, embedding, tagging, and graph stages throw explicit errors with stage names attached.
- Failure of one item does not stop the worker or detach queue listeners.
- Duplicate in-flight processing is skipped.
- Error details are truncated before saving so oversized model responses do not bloat SQLite rows.

## Design decisions and trade-offs

- `sqlite-vec` usage
  - I am using regular-table BLOB storage plus `vec_distance_cosine()` instead of a dedicated `vec0` virtual table.
  - Trade-off: brute-force KNN is slower than `vec0`, but it keeps the schema simple, avoids hard-coding an embedding dimension, and still satisfies sqlite-vec's binary vector format and nearest-neighbour query path for the current project size.

- Queue model
  - The EventEmitter queue is process-local and non-durable.
  - Trade-off: simple and already present, but queued work is lost across crashes. That is acceptable for this milestone because items remain in SQLite with `pending` status and can be retried.

- LLM outputs
  - Prompts will demand compact plain text / JSON-like responses, but parsing will still be defensive because local models are not perfectly structured.

- Reprocessing semantics
  - Auto-generated edges and tags for an item will be replaced on reprocessing.
  - Trade-off: simpler consistency model than diffing prior results.
