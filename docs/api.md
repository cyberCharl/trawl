# Trawl API

The Trawl API is a Bun + Hono service backed by SQLite.

## Base behavior

- `GET /health` is open.
- All `/items` routes require `Authorization: Bearer <API_KEY>`.
- Capture is intentionally lightweight.
- `POST /items` and `POST /items/batch` do **not** trigger processing automatically.
- Processing is only queued by `POST /items/:id/process`.

## Authentication

Trawl currently uses static Bearer tokens configured from environment variables.

- `API_KEY` adds one accepted token
- `API_KEYS` adds optional extra accepted tokens as a comma-separated list
- if both are set, all listed tokens are accepted
- generate strong values, for example: `openssl rand -hex 32`
- authenticated clients send one accepted token as:
  - `Authorization: Bearer <TOKEN>`
- there is no built-in token minting, database-backed credential store, expiry, or refresh flow yet

This supports simple self-hosted patterns like:

- one token for the web app server
- one token for the Obsidian plugin
- one token for scripts or automation
- overlap during token rotation without immediate downtime

## Item shape returned by the API

Normal item responses exclude `content_extract` and embedding data.

```ts
{
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
  status: "pending" | "processed" | "failed" | "archived";
  obsidian_note_id: string | null;
  tags: string[];
}
```

## Duplicate capture semantics

Repeated capture of the same URL updates the existing item instead of creating a second record.

- `captured_at`: first time the URL entered Trawl
- `last_seen_at`: most recent re-capture time

## Endpoints

### `GET /health`

```bash
curl http://localhost:3100/health
```

Response:

```json
{ "status": "ok" }
```

### `POST /items`

Capture a single URL.

```bash
curl -X POST http://localhost:3100/items \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "source": "web",
    "source_context": "browser cleanup"
  }'
```

Behavior:

- returns `201` for a new item
- returns `200` for a duplicate capture
- does not auto-process

### `POST /items/batch`

Capture many URLs in one request.

```bash
curl -X POST http://localhost:3100/items/batch \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/one",
      "https://example.com/two",
      "notaurl"
    ],
    "source": "web"
  }'
```

Response includes:

- `results`: created or duplicate items
- `errors`: invalid lines
- `summary`: counts for `received`, `created`, `duplicates`, `invalid`

### `GET /items`

List items newest first by `last_seen_at`, then `captured_at`.

Query parameters:

- `status`: optional, one of `pending | processed | failed | archived`
- `limit`: optional, default `50`, max `100`
- `offset`: optional, default `0`

```bash
curl "http://localhost:3100/items?status=pending&limit=25" \
  -H "Authorization: Bearer $API_KEY"
```

### `GET /items/:id`

Fetch one item by id.

```bash
curl http://localhost:3100/items/<ITEM_ID> \
  -H "Authorization: Bearer $API_KEY"
```

### `PATCH /items/:id`

Update selected mutable fields.

Supported fields:

- `status`
- `tags`
- `source_context`
- `obsidian_note_id`

`obsidian_note_id` is the future backlink to the Obsidian note frontmatter `id`, not a file path.

```bash
curl -X PATCH http://localhost:3100/items/<ITEM_ID> \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "archived",
    "tags": ["research", "capture-flow"],
    "source_context": "weekly review",
    "obsidian_note_id": "source-123"
  }'
```

### `POST /items/:id/process`

Queue explicit processing for an item.

```bash
curl -X POST http://localhost:3100/items/<ITEM_ID>/process \
  -H "Authorization: Bearer $API_KEY"
```

Behavior:

- returns `202` when processing is queued
- retries failed items by resetting them to `pending`
- returns `409` for already processed items
- returns `409` for archived items

## Processing pipeline

Current worker steps:

1. fetch page content
2. extract readable text
3. generate summary
4. generate tags
5. mark item `processed` or `failed`

Embeddings and graph work are intentionally out of the active path for now.

## API tests

The repo includes integration tests covering:

- auth behavior
- capture-only semantics
- duplicate capture timestamps
- batch capture
- listing, filtering, and single-item retrieval
- patch behavior
- explicit processing route rules

Run them with:

```bash
bun run test:api
```
