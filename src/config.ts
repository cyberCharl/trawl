const DEFAULT_PORT = 3000;
const DEFAULT_DB_PATH = "./data/trawl.db";

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return port;
}

function requireApiKey(value: string | undefined): string {
  if (!value) {
    throw new Error("API_KEY is required");
  }

  return value;
}

export const config = {
  port: parsePort(process.env.PORT),
  apiKey: requireApiKey(process.env.API_KEY),
  dbPath: process.env.DB_PATH ?? DEFAULT_DB_PATH,
} as const;
