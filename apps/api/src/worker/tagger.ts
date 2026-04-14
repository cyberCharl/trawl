import type { ItemRow } from "../db/types";
import { config } from "../config";
import { chatWithOllama } from "./ollama";

const MAX_TAG_INPUT = 600;
const SOURCE_CONTEXT_SOURCES = new Set(["agent"]);
const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "been",
  "being",
  "between",
  "from",
  "have",
  "into",
  "more",
  "most",
  "such",
  "than",
  "that",
  "their",
  "them",
  "these",
  "they",
  "this",
  "through",
  "using",
  "with",
  "without",
  "encyclopedia",
  "free",
  "software",
  "the",
  "wikipedia",
]);

const PHRASE_PATTERNS = [
  { pattern: /\bartificial intelligence\b/g, slug: "artificial-intelligence" },
  { pattern: /\bmachine learning\b/g, slug: "machine-learning" },
  { pattern: /\bgenerative ai\b/g, slug: "generative-ai" },
  { pattern: /\bdeep learning\b/g, slug: "deep-learning" },
  { pattern: /\bnatural language processing\b/g, slug: "natural-language-processing" },
  { pattern: /\bknowledge graph\b/g, slug: "knowledge-graph" },
  { pattern: /\bsemantic search\b/g, slug: "semantic-search" },
  { pattern: /\bjavascript runtime\b/g, slug: "javascript-runtime" },
  { pattern: /\bpackage manager\b/g, slug: "package-manager" },
  { pattern: /\btest runner\b/g, slug: "test-runner" },
  { pattern: /\bopen source\b/g, slug: "open-source" },
  { pattern: /\banthropic\b/g, slug: "anthropic" },
  { pattern: /\bsqlite\b/g, slug: "sqlite" },
  { pattern: /\bbun\b/g, slug: "bun" },
] as const;

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trim();
}

function slugifyTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractJsonPayload(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  for (const pattern of [/\{[\s\S]*\}/, /\[[\s\S]*\]/]) {
    const match = trimmed.match(pattern);

    if (!match) {
      continue;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeTags(raw: unknown): string[] {
  const values =
    Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { tags?: unknown }).tags)
        ? ((raw as { tags: unknown[] }).tags ?? [])
        : [];

  const tags = values
    .filter((value): value is string => typeof value === "string")
    .map(slugifyTag)
    .filter((value) => value.length > 0);

  return Array.from(new Set(tags)).slice(0, 5);
}

function countMatches(haystack: string, needles: string[]): number {
  let matches = 0;

  for (const needle of needles) {
    if (needle.length > 0 && haystack.includes(needle)) {
      matches += 1;
    }
  }

  return matches;
}

function buildHeuristicTags(params: {
  item: ItemRow;
  title: string | null;
  content: string;
  summary: string;
  taxonomy: string[];
}): string[] {
  const sourceContext =
    SOURCE_CONTEXT_SOURCES.has(params.item.source) && params.item.source_context
      ? params.item.source_context
      : "";
  const combinedText = `${params.title ?? ""} ${params.summary} ${sourceContext}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ");

  const tags: string[] = [];

  for (const slug of params.taxonomy) {
    const parts = slug.split("-").filter(Boolean);

    if (parts.length > 0 && countMatches(combinedText, parts) >= Math.max(1, parts.length - 1)) {
      tags.push(slug);
    }
  }

  for (const { pattern, slug } of PHRASE_PATTERNS) {
    if (!tags.includes(slug) && pattern.test(combinedText)) {
      tags.push(slug);
    }
  }

  const words = combinedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));

  const frequencies = new Map<string, number>();

  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }

  const rankedWords = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word);

  for (const candidate of rankedWords) {
    const slug = slugifyTag(candidate);

    if (slug.length >= 3 && !tags.includes(slug)) {
      tags.push(slug);
    }

    if (tags.length >= 5) {
      break;
    }
  }

  return tags.slice(0, 5);
}

export async function autoTagItem(params: {
  item: ItemRow;
  title: string | null;
  content: string;
  summary: string;
  taxonomy: string[];
}): Promise<string[]> {
  const promptParts = [
    `URL: ${params.item.url}`,
    `Title: ${params.title ?? "(unknown)"}`,
    "",
    "Choose 2 to 5 domain-oriented tags for this captured item.",
    "Prefer existing taxonomy slugs when they fit. You may propose new slugs if needed.",
    "Avoid structural tags like article, blog, link, summary, note, or reading-list.",
    'Return JSON only in the form {"tags":["tag-one","tag-two"]}.',
    "",
    params.taxonomy.length > 0
      ? `Existing taxonomy: ${params.taxonomy.join(", ")}`
      : "Existing taxonomy: (empty)",
  ];

  if (
    SOURCE_CONTEXT_SOURCES.has(params.item.source) &&
    typeof params.item.source_context === "string" &&
    params.item.source_context.trim().length > 0
  ) {
    promptParts.push("", "Source context:", clipText(params.item.source_context, 2000));
  }

  promptParts.push("", "Summary:", params.summary);
  promptParts.push("", "Content:", clipText(params.content, MAX_TAG_INPUT));

  let tags: string[] = [];

  try {
    const response = await chatWithOllama(
      config.taggingModel,
      [
        {
          role: "system",
          content:
            "You assign compact topical tags to captured knowledge items. Output strict JSON only.",
        },
        {
          role: "user",
          content: promptParts.join("\n"),
        },
      ],
      { timeoutMs: 15000 },
    );

    const parsed = extractJsonPayload(response);
    tags = normalizeTags(parsed);
  } catch {
    tags = buildHeuristicTags(params);
  }

  if (tags.length < 2) {
    throw new Error("Tagging response did not contain at least 2 usable tags");
  }

  return tags;
}
