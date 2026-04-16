const DEFAULT_PORT = 3100;
const DEFAULT_DB_PATH = "./data/trawl.db";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_SUMMARY_MODEL = "qwen3:8b";
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_TAGGING_MODEL = "qwen3:8b";
const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

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

function parseApiKeys(singleValue: string | undefined, multiValue: string | undefined): string[] {
  const keys = Array.from(
    new Set(
      [singleValue ?? "", ...(multiValue?.split(/[\n,]/g) ?? [])]
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (keys.length === 0) {
    throw new Error("Set API_KEY or API_KEYS with at least one bearer token");
  }

  return keys;
}

function parseUnitFloat(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }

  return parsed;
}

export const config = {
  port: parsePort(process.env.PORT),
  apiKeys: parseApiKeys(process.env.API_KEY, process.env.API_KEYS),
  dbPath: process.env.DB_PATH ?? DEFAULT_DB_PATH,
  ollamaUrl: process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
  summaryModel: process.env.SUMMARY_MODEL ?? DEFAULT_SUMMARY_MODEL,
  embeddingModel: process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
  taggingModel: process.env.TAGGING_MODEL ?? DEFAULT_TAGGING_MODEL,
  similarityThreshold: parseUnitFloat(
    process.env.SIMILARITY_THRESHOLD,
    DEFAULT_SIMILARITY_THRESHOLD,
    "SIMILARITY_THRESHOLD",
  ),
} as const;
