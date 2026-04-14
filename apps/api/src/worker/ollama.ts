import { config } from "../config";

type OllamaChatMessage = {
  role: "system" | "user";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

type OllamaEmbedResponse = {
  embeddings?: number[][];
  error?: string;
};

const OLLAMA_REQUEST_TIMEOUT_MS = 20000;
const OLLAMA_KEEP_ALIVE = "10m";

type OllamaRequestOptions = {
  timeoutMs?: number;
};

function stripThinkBlocks(value: string): string {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function postJson<T>(
  path: string,
  body: unknown,
  options: OllamaRequestOptions = {},
): Promise<T> {
  const response = await fetch(new URL(path, config.ollamaUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? OLLAMA_REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    const message =
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload;
}

export async function chatWithOllama(
  model: string,
  messages: OllamaChatMessage[],
  options: OllamaRequestOptions = {},
): Promise<string> {
  const payload = await postJson<OllamaChatResponse>("/api/chat", {
    model,
    messages,
    stream: false,
    keep_alive: OLLAMA_KEEP_ALIVE,
  }, options);

  if (typeof payload.error === "string" && payload.error.length > 0) {
    throw new Error(payload.error);
  }

  const content = payload.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama chat returned an empty response");
  }

  return stripThinkBlocks(content);
}

export async function embedWithOllama(
  model: string,
  input: string,
  options: OllamaRequestOptions = {},
): Promise<number[]> {
  const payload = await postJson<OllamaEmbedResponse>("/api/embed", {
    model,
    input,
    keep_alive: OLLAMA_KEEP_ALIVE,
  }, options);

  if (typeof payload.error === "string" && payload.error.length > 0) {
    throw new Error(payload.error);
  }

  const embedding = payload.embeddings?.[0];

  if (!embedding || embedding.length === 0) {
    throw new Error("Ollama embed returned an empty embedding");
  }

  return embedding;
}

export async function warmChatModel(model: string): Promise<void> {
  await chatWithOllama(
    model,
    [
      {
        role: "system",
        content: "Reply with OK.",
      },
      {
        role: "user",
        content: "OK",
      },
    ],
    { timeoutMs: 60000 },
  );
}

export async function warmEmbedModel(model: string): Promise<void> {
  await embedWithOllama(model, "warmup", { timeoutMs: 60000 });
}
