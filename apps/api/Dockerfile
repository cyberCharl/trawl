FROM oven/bun:1

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy all workspace package.json files for bun workspace resolution
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json

RUN bun install --frozen-lockfile

COPY apps/api/ apps/api/
COPY packages/ packages/

RUN mkdir -p /app/data

EXPOSE 3100

CMD ["bun", "apps/api/src/index.ts"]
