import { serve } from "bun";

import { app } from "./app";
import { config } from "./config";
import { captureQueue } from "./queue";

captureQueue.on("item:queued", (itemId) => {
  console.info(`Queued item ${itemId} for background processing`);
});

serve({
  port: config.port,
  fetch: app.fetch,
});

console.info(`Trawl listening on http://localhost:${config.port}`);
