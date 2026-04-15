FROM oven/bun:1

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
RUN mkdir -p /app/data

EXPOSE 3100

CMD ["bun", "src/index.ts"]
