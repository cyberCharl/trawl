import type { MiddlewareHandler } from "hono";

import { config } from "../config";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("Authorization");
  const expectedAuthorization = `Bearer ${config.apiKey}`;

  if (authorization !== expectedAuthorization) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
