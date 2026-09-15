import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuthenticatedRequest } from "../../modules/identity/http/auth-request.js";
import type { ApiRateLimitPolicy, ApiRateLimiter } from "./api-rate-limiter.js";

export interface ApiRateLimitMiddlewareOptions extends ApiRateLimitPolicy {
  readonly bucket: string;
  readonly identity?: "trusted-ip" | "authenticated-user";
  readonly methods?: readonly string[];
}

export function createApiRateLimitMiddleware(
  limiter: ApiRateLimiter,
  options: ApiRateLimitMiddlewareOptions,
): RequestHandler {
  const methodSet = options.methods
    ? new Set(options.methods.map((method) => method.toUpperCase()))
    : null;
  return async (request: Request, response: Response, next: NextFunction) => {
    if (methodSet && !methodSet.has(request.method.toUpperCase())) {
      next();
      return;
    }

    try {
      const policy: ApiRateLimitPolicy = {
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.windowSeconds === undefined ? {} : { windowSeconds: options.windowSeconds }),
      };
      const decision = await limiter.consume(
        options.bucket,
        requestIdentifier(request, options),
        policy,
      );
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

function requestIdentifier(request: Request, options: ApiRateLimitMiddlewareOptions): string {
  if (options.identity === "authenticated-user") {
    const userId = (request as AuthenticatedRequest).auth?.userId;
    if (userId) return `user:${userId}`;
  }
  const ip = request.ips?.[0] || request.ip || request.socket.remoteAddress || "unknown";
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}
