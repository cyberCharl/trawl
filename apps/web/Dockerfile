FROM oven/bun:1 AS base

FROM base AS install
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN bun install

FROM base AS build
WORKDIR /app
COPY --from=install /app/node_modules node_modules
COPY --from=install /app/apps/web/node_modules apps/web/node_modules
COPY --from=install /app/packages packages
COPY . .
RUN bun run --filter=web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
