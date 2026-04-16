import { timingSafeEqual } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import { config } from "../config";

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function isAuthorizedToken(token: string | null): boolean {
  if (!token) {
    return false;
  }

  const tokenBuffer = Buffer.from(token);

  return config.apiKeys.some((apiKey) => {
    const apiKeyBuffer = Buffer.from(apiKey);

    return apiKeyBuffer.length === tokenBuffer.length && timingSafeEqual(apiKeyBuffer, tokenBuffer);
  });
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!isAuthorizedToken(parseBearerToken(authorization))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
