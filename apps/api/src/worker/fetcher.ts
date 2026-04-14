import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type ExtractedContent = {
  title: string | null;
  content: string;
};

const MAX_CONTENT_LENGTH = 50000;
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; TrawlWorker/0.1; +https://localhost/trawl)";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function clipText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).trim();
}

export async function fetchAndExtract(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (rawBody.trim().length === 0) {
    throw new Error("Fetched document was empty");
  }

  if (!contentType.includes("html")) {
    return {
      title: null,
      content: clipText(normalizeText(rawBody), MAX_CONTENT_LENGTH),
    };
  }

  const { document } = parseHTML(rawBody);
  const article = new Readability(document).parse();

  const title = normalizeText(article?.title ?? document.title ?? null) || null;
  const articleText = normalizeText(article?.textContent);
  const bodyText = normalizeText(document.body?.textContent);
  const content = clipText(articleText || bodyText, MAX_CONTENT_LENGTH);

  if (!content) {
    throw new Error("Could not extract readable content from document");
  }

  return {
    title,
    content,
  };
}
