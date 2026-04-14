# Trawl — System Definition

## Vision

Trawl is a self-hosted link capture and research curation service for personal knowledge management. It solves a specific problem: links get lost. Papers flagged months ago disappear into daily notes. Browser tabs accumulate and get closed. Interesting articles surface at the wrong time and vanish before they can be used. There is no reliable way to answer: _what did I save recently that is relevant to what I am working on now?_

Trawl is not a knowledge base. It is the **staging area upstream of one**. Links enter Trawl quickly and cheaply, sit there with minimal metadata, and get promoted into the Obsidian vault as source documents only when deliberately selected for processing. The vault is the destination; Trawl is the holding pen and index.

The long-term ambition is for Trawl to also act as a content curation layer — surfacing saved items at intervals, filtered by relevance to current work, replacing doom-scrolling with intentional reading from a self-curated pool. That layer is deferred until the core capture-and-process loop works.

---

## Core Principles

- **Capture is fast, processing is deliberate.** Default ingest stores the URL and light metadata only. No fetch, no LLM calls, no embeddings, no summarisation on capture.
- **Processing is by explicit selection.** A human or agent marks an item for processing. Trawl may later suggest items worth processing, but enrichment is always an intentional act.
- **Trawl is a permanent index.** Items are never removed from the store as part of normal processing. Search and filtering should span everything ever captured.
- **Processing and promotion are separate steps.** Processing enriches the Trawl record. Promotion creates or links the corresponding Obsidian source note.
- **Obsidian remains the knowledge system of record.** Trawl manages capture, queueing, and lightweight curation upstream of the vault.

---

## What Trawl Must Do First

This document should be treated as a roadmap, not a statement that every part already exists.

The immediate goal is a working personal workflow:

1. Save links quickly.
2. View saved links.
3. Bulk-add links from a browser cleanup or reading list.
4. Select specific items for processing.
5. Create corresponding source notes in Obsidian without duplicates.

Anything beyond that is secondary until this loop is stable.

---

## Phased Roadmap

## Phase 1 — Core Capture API

Goal: make Trawl a reliable holding pen.

Scope:

- Capture a URL quickly.
- Store item metadata and status.
- List items and inspect single items.
- Support duplicate capture without losing first-captured history.

Not in scope:

- Automatic processing on capture
- Embeddings
- Knowledge graph
- Semantic surfacing
- Obsidian note creation

## Phase 2 — Minimal Web App

Goal: provide immediate everyday utility before plugin work.

Scope:

- A simple two-page Next.js app:
  - **Bulk Capture** page: paste URLs, one per line, save them.
  - **Inbox / Items** page: view captured links, filter by status, manually trigger processing, open the original link.
- This becomes the first practical UI for day-to-day use.

Not in scope:

- Rich search UX
- Complex dashboards
- Realtime updates beyond simple polling

## Phase 3 — Deliberate Processing Pipeline

Goal: enrich selected items only.

Scope:

- Explicit processing trigger per item.
- Fetch page content.
- Extract readable text.
- Generate summary.
- Generate tags.
- Mark item as processed or failed.

Explicitly deferred from processing:

- Embeddings
- Graph edges
- Semantic similarity

## Phase 4 — Obsidian Plugin

Goal: promote processed items into the vault.

Scope:

- Browse Trawl items from Obsidian.
- Trigger processing.
- Create a source note from a template.
- Write back the Obsidian note `id` frontmatter value to Trawl.
- Prevent duplicate note creation by checking for an existing linked `id`.

## Phase 5 — Search, Curation, and Graph Work

Goal: improve retrieval once enough content exists.

Scope:

- Embeddings
- Semantic search
- Graph edges
- Relevance surfacing
- Time-aware resurfacing
- Daily digest workflows

---

## Architecture Overview

### Near-term architecture

```text
Capture surfaces
  - API
  - Next.js web app
  - Agent
  - Later: browser extension, Obsidian plugin

        │
        ▼
   Trawl API
 (Bun + Hono)
        │
        ▼
      SQLite
```

### Later architecture

```text
Capture surfaces
  - API
  - Web app
  - Agent
  - Browser extension
  - Obsidian plugin

        │
        ▼
   Trawl API
 (Bun + Hono)
        │
        ├──▶ SQLite
        │
        └──▶ Processing worker
              - fetch
              - extract
              - summarise
              - tag
              - later: embed and graph
```

**Current stack direction:** Bun + Hono + SQLite.

**Deferred stack work:** `sqlite-vec` and graph logic stay out of the critical path until the core loop is proven useful.

**Networking:** all devices on the same Tailscale mesh. No public internet exposure. Auth is a simple Bearer token on `/items` endpoints; `/health` is open.

---

## Data Model

### Item

```typescript
{
  id: string,                       // UUID or nanoid
  url: string,                      // unique
  title: string | null,
  content_extract: string | null,   // DB only, excluded from normal API responses
  summary: string | null,
  tags: string[],                   // joined from item_tags + tags tables
  error_details: string | null,
  source: 'extension' | 'web' | 'api' | 'agent',
  source_context: string | null,    // freeform detail (agent/session/context)
  captured_at: string,              // first capture timestamp
  last_seen_at: string,             // most recent re-capture timestamp
  processed_at: string | null,      // enrichment completion timestamp
  status: 'pending' | 'processed' | 'failed' | 'archived',
  obsidian_note_id: string | null,  // the Obsidian note frontmatter `id`
}
```

### Status semantics

- `pending` — captured, not yet enriched
- `processed` — enrichment completed successfully
- `failed` — enrichment attempted and failed
- `archived` — intentionally removed from the active working set

Important: `processed` does **not** mean the item has already been turned into an Obsidian note. Promotion into the vault is tracked separately through `obsidian_note_id`.

### Duplicate capture semantics

Trawl should treat repeated capture of the same URL as the same item.

- `captured_at` = first time the URL entered Trawl
- `last_seen_at` = most recent time the URL was saved again

This preserves both origin history and recency.

### Supporting Tables

| Table       | Shape                                                   | Purpose                                             |
| ----------- | ------------------------------------------------------- | --------------------------------------------------- |
| `tags`      | `{ id, name, slug }`                                    | Tag registry                                        |
| `item_tags` | `{ item_id, tag_id }`                                   | Join table                                          |
| `edges`     | `{ source_item_id, target_item_id, edge_type, weight }` | Deferred. Reserved for later graph-style relations. |

---

## API Contract

All `/items` endpoints require `Authorization: Bearer <API_KEY>`. `/health` is open.

### Implemented today

| Method | Path      | Purpose      | Notes                                           |
| ------ | --------- | ------------ | ----------------------------------------------- |
| `GET`  | `/health` | Health check | No auth                                         |
| `POST` | `/items`  | Capture URL  | Should remain lightweight and capture-only      |

### Core endpoints needed next

| Method  | Path                 | Purpose                  | Notes |
| ------- | -------------------- | ------------------------ | ----- |
| `GET`   | `/items`             | List items               | Filter by `status`, paginate, return newest first. |
| `GET`   | `/items/:id`         | Get single item          | Needed for UI detail views and polling. |
| `PATCH` | `/items/:id`         | Update item fields       | At minimum: `obsidian_note_id`, `status`, `tags`, `source_context`. |
| `POST`  | `/items/:id/process` | Trigger processing       | Async trigger. Returns immediately. |
| `POST`  | `/items/batch`       | Batch capture            | Useful for bulk paste workflows in the web app. |

### Explicit API rule

`POST /items` should **not** automatically trigger enrichment by default. Capture and processing must remain separate actions.

A temporary development flag for auto-processing is acceptable while experimenting, but it should not define the product model.

---

## Processing Pipeline

Triggered by `POST /items/:id/process`. Runs asynchronously.

### Core processing steps

1. **Fetch** — retrieve page content from the URL.
2. **Extract** — pull readable text and store it in `content_extract`.
3. **Summarise** — generate a concise summary.
4. **Tag** — apply tags and write them to `item_tags`.
5. **Update status** — set `status` to `processed` and write `processed_at`.

On failure at any step:

- set `status` to `failed`
- write detail to `error_details`

### Explicitly deferred from processing

These are useful, but not part of the initial processing milestone:

- Embedding generation
- Vector search population
- Similarity edge computation
- Graph edge rebuilding

### Open questions — processing

- Which local model handles summarisation and tagging?
  - Current direction: local Ollama models.
- What retry behavior should failed items have?
  - Manual retry is enough initially.
- How should clients observe completion?
  - Start with polling; defer SSE/webhooks.

---

## Capture Surfaces

In priority order:

### 1. API

The foundational surface. Everything else writes through it. The agent uses this to capture links encountered during research sessions.

### 2. Web App — Immediate UI

This is the next highest-value piece after the API.

A very basic Next.js app should provide two pages:

#### Bulk Capture page

Use case: clearing browser tabs, saving a reading list, dumping URLs from a research session.

- Textarea for pasting URLs, one per line
- Submit button
- Optional per-line validation feedback

#### Inbox / Items page

Use case: seeing what is in Trawl and deciding what to do next.

- View saved items and statuses
- Filter by status
- Trigger processing manually
- Click item to open original URL in a new tab

This UI should be intentionally simple and operational rather than polished.

### 3. Obsidian Plugin

The main knowledge-work integration. It comes after the basic web app because the web app delivers immediate value sooner and helps validate the API shape first.

### 4. Browser Extension

Nice-to-have later. Single-click capture of the current page with `source: 'extension'`.

---

## Obsidian Plugin

The plugin is the promotion layer from Trawl into the vault.

### Core behaviour

1. **Browse saved links** — query `GET /items` filtered by status, display in a sidebar or modal.
2. **Trigger processing** — select a link and call `POST /items/:id/process`.
3. **Create vault note** — once processing completes, create a source note at a configurable vault location using a configurable template.
4. **Write back note id** — after creating the note, call `PATCH /items/:id` with `{ obsidian_note_id: "<frontmatter-id>" }`.
5. **Duplicate prevention** — before creating a note, check if `obsidian_note_id` is already set. If so, open the existing note instead of creating a duplicate.

### Why `obsidian_note_id`

The authoritative link back to Obsidian is the note's frontmatter `id` field, not a file path.

This avoids stale references when files are renamed or moved in the vault and matches the existing vault convention.

### Configuration

- **Trawl API URL** — Tailscale address of the Trawl server
- **API key** — Bearer token
- **Note destination folder** — vault path where source notes are created
- **Note template** — configurable, with defaults
- **ID strategy** — the plugin is responsible for assigning or preserving the note frontmatter `id`

Template variables:

- `{{title}}`
- `{{url}}`
- `{{summary}}`
- `{{tags}}`
- `{{captured_at}}`
- `{{processed_at}}`
- `{{trawl_id}}`

### Deferred feature

- **Remote note creation sync** — when processing is triggered from the web app rather than the plugin, the plugin should still be able to detect newly processed items where `obsidian_note_id` is null and offer to create the note.

---

## Deferred Work

These are real requirements but explicitly out of scope until the core loop is working and useful:

- **Embeddings and vector search**
- **Knowledge graph / edges**
- **Semantic surfacing and recommendation**
- **Calendar / time-aware resurfacing**
- **Readwise import**
- **Browser extension**
- **Realtime notifications beyond polling**

---

## Repository Strategy

Recommended direction: **one monorepo, no git submodules**.

### Why monorepo

For a personal staged build, the biggest advantages are:

- shared TypeScript types between API, web app, plugin, and later extension
- shared API client code
- coordinated changes to request/response contracts
- simpler local development
- less release and versioning overhead

### Why not submodules

Git submodules add friction without much benefit here:

- more awkward cloning and setup
- annoying cross-repo change coordination
- harder to evolve shared types and contracts
- poor fit for a tightly-coupled personal system

### Suggested structure

A simple workspace-based monorepo is enough. No need for a heavy build system initially.

```text
/apps
  /api
  /web
  /obsidian-plugin
  /firefox-extension    # later
/packages
  /shared-types
  /api-client           # optional, can be added later
```

Because the current project already uses Bun, Bun workspaces are a reasonable default. If that feels premature, keep a single repo with top-level app directories first and formalize workspaces when the web app or plugin lands.

### Pragmatic recommendation

- **Now:** keep one repo
- **Next:** grow into a workspace monorepo when the web app starts
- **Later:** only split something out if it truly develops an independent lifecycle

---

## Missing Items Checklist

### Phase 1 — API and data model

- [ ] Ensure `POST /items` is capture-only by default
- [ ] Add `GET /items`
- [ ] Add `GET /items/:id`
- [ ] Add `PATCH /items/:id`
- [ ] Add `POST /items/:id/process`
- [ ] Add `POST /items/batch`
- [ ] Update `source` enum to `'extension' | 'web' | 'api' | 'agent'`
- [ ] Add `last_seen_at`
- [ ] Preserve `captured_at` as first-seen timestamp
- [ ] Exclude `content_extract` from normal API responses
- [ ] Return joined `tags` in item responses

### Phase 2 — minimal web app

- [ ] Scaffold Next.js app
- [ ] Bulk Capture page
- [ ] Inbox / Items page
- [ ] Manual processing trigger from UI
- [ ] Basic status polling

### Phase 3 — processing pipeline

- [ ] Implement explicit process trigger
- [ ] Implement fetch + extract
- [ ] Implement summarisation
- [ ] Implement tagging
- [ ] Error handling and retry flow
- [ ] Keep embeddings and graph steps out of the critical path

### Phase 4 — Obsidian plugin

- [ ] Plugin scaffold
- [ ] Settings page and API connection
- [ ] Item browser view
- [ ] Processing trigger
- [ ] Note creation from template
- [ ] Write back `obsidian_note_id`
- [ ] Duplicate detection based on existing note `id`

### Later

- [ ] Embedding model selection
- [ ] Vector search endpoint
- [ ] Graph/edge computation
- [ ] Surfacing and curation workflows
- [ ] Browser extension

### Decisions already made

- [x] Trawl is a staging layer upstream of Obsidian
- [x] Processing is explicit, not automatic
- [x] Obsidian linkage uses note frontmatter `id`
- [x] Minimal web app comes before the Obsidian plugin
- [x] Embeddings and graph work are deferred until later
- [x] Monorepo is preferred over git submodules

### Decisions still open

- [ ] Default note template format
- [ ] Polling interval for processing status
- [ ] Whether reprocessing should overwrite summary/tags or preserve edits
