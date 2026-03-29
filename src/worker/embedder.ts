import { config } from "../config";
import { embedWithOllama } from "./ollama";

const FALLBACK_EMBEDDING_MODEL = "qwen3:4b";
const MAX_EMBED_INPUT = 6000;

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trim();
}

function serializeFloat32(values: number[]): Uint8Array {
  const buffer = new ArrayBuffer(values.length * Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(buffer);

  for (const [index, value] of values.entries()) {
    view.setFloat32(index * Float32Array.BYTES_PER_ELEMENT, value, true);
  }

  return new Uint8Array(buffer);
}

function isMissingModelError(error: unknown): boolean {
  return error instanceof Error && /model.+not found/i.test(error.message);
}

export async function generateEmbedding(params: {
  title: string | null;
  summary: string;
  content: string;
}): Promise<Uint8Array> {
  const input = clipText(
    [params.title ?? "", params.summary, params.content].filter(Boolean).join("\n\n"),
    MAX_EMBED_INPUT,
  );

  try {
    const embedding = await embedWithOllama(config.embeddingModel, input);
    return serializeFloat32(embedding);
  } catch (error) {
    if (!isMissingModelError(error) || config.embeddingModel === FALLBACK_EMBEDDING_MODEL) {
      throw error;
    }

    const fallbackEmbedding = await embedWithOllama(FALLBACK_EMBEDDING_MODEL, input);
    return serializeFloat32(fallbackEmbedding);
  }
}
