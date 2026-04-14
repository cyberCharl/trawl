# Trawl

Trawl is a self-hosted capture and retrieval tool for saving links, enriching them in the background, and surfacing them again through semantic search, auto-tagging, and graph relationships.

This repo is now structured as a monorepo so the API and the new Next.js + shadcn/ui frontend can evolve independently while sharing a reusable UI package.

## Workspace layout

- `apps/api` — Bun + Hono API
- `apps/web` — Next.js app router frontend
- `packages/ui` — shared shadcn/ui component package
- `packages/eslint-config` — shared ESLint config
- `packages/typescript-config` — shared TypeScript config

## Quick start

```bash
bun install
cp apps/api/.env.example apps/api/.env
bun run dev
```

That starts both workspaces through Turbo:

- web: `http://localhost:3000`
- api: `http://localhost:3100`

## Useful commands

```bash
bun run dev:web
bun run dev:api
bun run typecheck
bun run lint
```

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
