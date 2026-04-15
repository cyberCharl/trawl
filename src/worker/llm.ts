import { config } from "../config";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  } | string;
};

type EmbeddingsResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  } | string;
};

type LlmRequestOptions = {
  timeoutMs?: number;
};

const LLM_REQUEST_TIMEOUT_MS = 20000;

function stripThinkBlocks(value: string): string {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function getErrorMessage(payload: { error?: { message?: string } | string }): string | null {
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  if (
    payload.error &&
    typeof payload.error === "object" &&
    typeof payload.error.message === "string" &&
    payload.error.message.length > 0
  ) {
    return payload.error.message;
  }

  return null;
}

async function postJson<T>(
  path: string,
  body: unknown,
  options: LlmRequestOptions = {},
): Promise<T> {
  const response = await fetch(new URL(path, `${config.llmApiUrl}/`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json()) as T & { error?: { message?: string } | string };
  const errorMessage = getErrorMessage(payload);

  if (!response.ok) {
    throw new Error(errorMessage ?? `${response.status} ${response.statusText}`);
  }

  return payload;
}

function flattenMessageContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part.type === "text" || !part.type ? part.text ?? "" : ""))
    .join("")
    .trim();
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options: LlmRequestOptions = {},
): Promise<string> {
  const payload = await postJson<ChatCompletionResponse>(
    "/chat/completions",
    {
      model,
      messages,
    },
    options,
  );

  const errorMessage = getErrorMessage(payload);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const content = flattenMessageContent(payload.choices?.[0]?.message?.content).trim();

  if (!content) {
    throw new Error("Chat completion returned an empty response");
  }

  return stripThinkBlocks(content);
}

export async function createEmbedding(
  model: string,
  input: string,
  options: LlmRequestOptions = {},
): Promise<number[]> {
  const payload = await postJson<EmbeddingsResponse>(
    "/embeddings",
    {
      model,
      input,
      dimensions: config.embeddingDimensions,
    },
    options,
  );

  const errorMessage = getErrorMessage(payload);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error("Embeddings API returned an empty embedding");
  }

  return embedding;
}
