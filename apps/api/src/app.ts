import { Hono } from "hono";

import { authMiddleware } from "./middleware/auth";
import { healthRoutes } from "./routes/health";
import { itemRoutes } from "./routes/items";

export const app = new Hono();

app.route("/health", healthRoutes);
app.use("/items", authMiddleware);
app.route("/items", itemRoutes);
