# Trawl

Trawl is a self-hosted link capture and research curation tool.

It sits upstream of an Obsidian vault:

- capture links quickly
- review them in an inbox
- deliberately trigger enrichment only when an item is worth processing
- promote selected items into Obsidian later without losing the long-term index in Trawl

## What exists now

### API

The Bun + Hono API currently supports:

- `GET /health`
- `POST /items`
- `POST /items/batch`
- `GET /items`
- `GET /items/:id`
- `PATCH /items/:id`
- `POST /items/:id/process`

Important behavior:

- capture is capture-only by default
- duplicate URLs update `last_seen_at` while preserving the original `captured_at`
- normal item responses exclude `content_extract`
- tags are returned as joined slugs

### Web app

The Next.js app provides the first operational UI:

- `/capture` for bulk URL capture
- `/items` for the inbox view
- status filtering
- manual processing trigger
- polling while pending items are visible

### Obsidian plugin scaffold

A new plugin application now lives in `apps/obsidian-plugin`.

Current scaffold pieces:

- plugin manifest and build pipeline
- settings tab for API and note-template configuration
- connection test
- inbox modal listing Trawl items
- manual processing trigger for pending/failed items
- polling while pending items are visible
- source-note creation from the configured template
- `obsidian_note_id` write-back after note creation/open

## Workspace layout

- `apps/api` — Bun + Hono API
- `apps/web` — Next.js app-router frontend
- `apps/obsidian-plugin` — Obsidian plugin scaffold
- `packages/ui` — shared shadcn/ui component package
- `packages/eslint-config` — shared ESLint config
- `packages/typescript-config` — shared TypeScript config
- `docs/api.md` — API contract and examples
- `docs/development.md` — setup, testing, build, and CI/CD notes

## Quick start

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run dev
```

That starts the main local surfaces:

- web: `http://localhost:3000`
  - bulk capture: `http://localhost:3000/capture`
  - inbox: `http://localhost:3000/items`
- api: `http://localhost:3100`

## Useful commands

```bash
bun run dev:web
bun run dev:api
bun run dev:obsidian-plugin
bun run typecheck
bun run lint
bun run test
bun run test:api
bun run build
bun run build:obsidian-plugin
```

## API testing

The repository includes integration tests for the API covering:

- auth behavior
- capture-only semantics
- duplicate capture handling
- batch capture
- list/get/patch routes
- explicit processing route rules

Run them with:

```bash
bun run test:api
```

## CI/CD

GitHub Actions is configured for:

- CI on pushes and pull requests
  - install
  - typecheck
  - lint
  - test
  - build
- plugin release packaging
  - package the Obsidian plugin
  - upload build artifacts
  - publish plugin release assets on GitHub releases

Because the API and web app are self-hosted, runtime deployment is still intentionally left environment-specific.

## Documentation

- [API documentation](docs/api.md)
- [Development guide](docs/development.md)
- [Obsidian plugin README](apps/obsidian-plugin/README.md)

## Adding shadcn components

The monorepo is configured for shadcn/ui. Add components from the repo root with:

```bash
bunx --bun shadcn@latest add button -c apps/web
```

Components are written into `packages/ui/src/components` and can then be imported in the app with:

```tsx
import { Button } from "@trawl/ui/components/button";
```

## License

MIT
