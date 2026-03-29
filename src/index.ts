import { serve } from "bun";

import { app } from "./app";
import { config } from "./config";
import { captureQueue } from "./queue";
import { initializeWorker } from "./worker";

captureQueue.on("item:queued", (itemId) => {
  console.info(`Queued item ${itemId} for background processing`);
});

captureQueue.on("item:processed", (itemId) => {
  console.info(`Processed item ${itemId}`);
});

captureQueue.on("item:failed", (itemId, errorDetails) => {
  console.error(`Failed item ${itemId}: ${errorDetails}`);
});

await initializeWorker();

serve({
  port: config.port,
  fetch: app.fetch,
});

console.info(`Trawl listening on http://localhost:${config.port}`);
