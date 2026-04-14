import { config } from "../config";
import {
  getItemById,
  listTagTaxonomy,
  markItemFailed,
  markItemProcessed,
  replaceItemTags,
  saveExtractedContent,
  saveSummary,
} from "../db/items";
import { captureQueue } from "../queue";
import { fetchAndExtract } from "./fetcher";
import { warmChatModel } from "./ollama";
import { summariseItem } from "./summariser";
import { autoTagItem } from "./tagger";

const activeItems = new Set<string>();
const MAX_ERROR_DETAILS_LENGTH = 2000;

let workerInitialized = false;

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_ERROR_DETAILS_LENGTH);
  }

  return String(error).slice(0, MAX_ERROR_DETAILS_LENGTH);
}

async function runStage<T>(stageName: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${stageName}: ${normalizeError(error)}`);
  }
}

async function warmWorkerModels(): Promise<void> {
  const chatModels = Array.from(new Set([config.summaryModel, config.taggingModel]));
  const results = await Promise.allSettled(chatModels.map((model) => warmChatModel(model)));

  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      continue;
    }

    console.warn(`Worker warmup failed for chat model ${chatModels[index]}: ${normalizeError(result.reason)}`);
  }
}

async function processItem(itemId: string): Promise<void> {
  const item = getItemById(itemId);

  if (!item || item.status !== "pending") {
    return;
  }

  const extracted = await runStage("fetch", async () => fetchAndExtract(item.url));
  saveExtractedContent(item.id, extracted.title, extracted.content);

  const summary = await runStage("summary", async () =>
    summariseItem({
      url: item.url,
      title: extracted.title,
      content: extracted.content,
    }),
  );
  saveSummary(item.id, summary);

  const tags = await runStage("tagging", async () =>
    autoTagItem({
      item,
      title: extracted.title,
      content: extracted.content,
      summary,
      taxonomy: listTagTaxonomy(),
    }),
  );
  replaceItemTags(item.id, tags);

  markItemProcessed(item.id, new Date().toISOString());
}

async function handleQueuedItem(itemId: string): Promise<void> {
  if (activeItems.has(itemId)) {
    return;
  }

  activeItems.add(itemId);

  try {
    await processItem(itemId);

    const item = getItemById(itemId);

    if (item?.status === "processed") {
      captureQueue.emit("item:processed", itemId);
    }
  } catch (error) {
    const errorDetails = normalizeError(error);
    markItemFailed(itemId, errorDetails);
    captureQueue.emit("item:failed", itemId, errorDetails);
  } finally {
    activeItems.delete(itemId);
  }
}

export async function initializeWorker(): Promise<void> {
  if (workerInitialized) {
    return;
  }

  workerInitialized = true;

  captureQueue.on("item:queued", (itemId) => {
    void handleQueuedItem(itemId);
  });

  await warmWorkerModels();
}
