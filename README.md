# Trawl

A self-hosted personal capture and retrieval tool. Catches information from daily browsing and surfaces it when relevant — through semantic search, auto-tagging, and an emergent knowledge graph.

Replaces tools like OneTab, Pocket, and Raindrop with something simpler, agent-queryable, and fully under your control.

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| API | Hono (TypeScript) | Lightweight, fast |
| Runtime | Bun | Fast startup, native TypeScript |
| Database | SQLite + sqlite-vec | Items, tags, embeddings, graph edges |
| Frontend | TBD (Phase 2) | Search, tags, graph visualisation |

## Quick Start

```bash
bun install
cp .env.example .env
bun run dev
```

## License

MIT
