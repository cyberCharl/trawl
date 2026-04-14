import { config } from "../config";
import { chatWithOllama } from "./ollama";

const MAX_SUMMARY_INPUT = 1800;

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trim();
}

function buildFallbackSummary(content: string): string {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length === 0) {
    return clipText(content, 280);
  }

  return sentences.slice(0, 3).join(" ");
}

export async function summariseItem(params: {
  url: string;
  title: string | null;
  content: string;
}): Promise<string> {
  const content = clipText(params.content, MAX_SUMMARY_INPUT);
  const prompt = [
    `URL: ${params.url}`,
    `Title: ${params.title ?? "(unknown)"}`,
    "",
    "Produce a coherent 2-3 sentence summary of the page.",
    "Do not use bullet points, markdown, or preamble.",
    "Do not mention that you are summarising or analyzing.",
    "",
    "Content:",
    content,
  ].join("\n");

  try {
    const summary = await chatWithOllama(
      config.summaryModel,
      [
        {
          role: "system",
          content:
            "You write terse factual summaries of captured web pages. Reply with plain text only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      { timeoutMs: 20000 },
    );

    const normalizedSummary = summary.replace(/\s+/g, " ").trim();

    if (!normalizedSummary) {
      throw new Error("Summary response was empty");
    }

    return normalizedSummary;
  } catch {
    return buildFallbackSummary(content);
  }
}
