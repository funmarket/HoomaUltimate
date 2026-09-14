import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ApiRateLimiter } from "./api-rate-limiter.js";

export function createApiRateLimitMiddleware(
  limiter: ApiRateLimiter,
  bucket: string,
): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const decision = await limiter.consume(bucket, requestIdentifier(request));
      response.setHeader("RateLimit-Limit", String(decision.limit));
      response.setHeader("RateLimit-Remaining", String(decision.remaining));
      if (decision.allowed) {
        next();
        return;
      }
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));
      response.status(429).json({
        error: { code: "API_RATE_LIMITED", message: "Too many requests" },
      });
    } catch (error) {
      next(error);
    }
  };
}

function requestIdentifier(request: Request): string {
  const ip = request.ips?.[0] || request.ip || request.socket.remoteAddress || "unknown";
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}
