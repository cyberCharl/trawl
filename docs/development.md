# Development Guide

## Prerequisites

- Bun `1.3.x`
- Node `20+`
- local Ollama only if you want to run the processing worker end-to-end

## Local setup

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The API and web app can then be started together:

```bash
bun run dev
```

Useful targets:

```bash
bun run dev:api
bun run dev:web
bun run dev:obsidian-plugin
```

## Main local URLs

- API: `http://localhost:3100`
- Web bulk capture: `http://localhost:3000/capture`
- Web inbox: `http://localhost:3000/items`

## Quality checks

Repository-wide:

```bash
bun run typecheck
bun run lint
bun run build
```

API integration tests:

```bash
bun run test:api
```

Or through the root turbo task:

```bash
bun run test
```

## Notes on API testing

The API test suite runs against a temporary SQLite database and exercises the Hono app directly. It verifies the behavior promised by the system definition, especially:

- capture stays capture-only
- duplicate URLs preserve first-seen history
- `/items` listing and filtering work
- explicit processing remains a separate step

## Obsidian plugin scaffold

The plugin now lives in `apps/obsidian-plugin`.

Common commands:

```bash
bun run --filter=obsidian-plugin build
bun run --filter=obsidian-plugin package
```

The `package` script produces a `dist/` directory containing:

- `main.js`
- `manifest.json`
- `versions.json`
- `trawl-obsidian-plugin.zip`

## CI/CD

GitHub Actions is set up for two tracks:

### CI

`/.github/workflows/ci.yml`

Runs on pushes and pull requests and executes:

- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run build`

It also packages the Obsidian plugin and uploads it as a build artifact.

### CD

`/.github/workflows/release-obsidian-plugin.yml`

Runs on GitHub release publication and manually via workflow dispatch. It builds and packages the Obsidian plugin, then publishes the packaged files to the GitHub release.

## Deployment note

The repository now has automated validation and plugin release packaging. Actual deployment of the self-hosted API/web runtime is still environment-specific and should be wired once the target host or orchestration strategy is chosen.
