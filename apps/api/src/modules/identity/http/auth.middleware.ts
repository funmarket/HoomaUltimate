import type { NextFunction, Request, Response } from "express";
import type { ApiConfig } from "@hooma/config";
import { AppError } from "../../../http/errors/app-error.js";
import type { IdentityService } from "../application/identity.service.js";
import type { AuthContext } from "../domain/auth-context.js";
import type { AuthenticatedRequest } from "./auth-request.js";
import { readCookie } from "./cookies.js";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function resolveAuthentication(
  request: Request,
  service: IdentityService,
  config: ApiConfig,
): Promise<AuthContext | null> {
  const authorization = request.header("authorization") ?? "";
  const [scheme, rawInitData] = authorization.split(" ", 2);
  const hasTelegramCredential = scheme?.toLowerCase() === "tma";
  const telegram = await service.resolveTelegram(hasTelegramCredential ? rawInitData : undefined);

  if (hasTelegramCredential && telegram.kind === "invalid") {
    throw new AppError(
      401,
      "TELEGRAM_AUTH_INVALID",
      "Invalid or expired Telegram authentication",
    );
  }

  const rawSession = readCookie(request, config.SESSION_COOKIE_NAME);
  const webUserId = await service.resolveWebSession(rawSession);
  const telegramUserId = telegram.kind === "valid" ? telegram.userId : null;

  if (telegramUserId && webUserId && telegramUserId !== webUserId) {
    throw new AppError(
      401,
      "AUTH_CONFLICT",
      "Telegram and Web credentials resolve to different users",
    );
  }

  const userId = telegramUserId ?? webUserId;
  if (!userId) return null;

  const transports = [
    ...(webUserId ? (["web"] as const) : []),
    ...(telegramUserId ? (["telegram"] as const) : []),
  ];
  return { userId, transports };
}

export function requireAuthentication(service: IdentityService, config: ApiConfig) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const auth = await resolveAuthentication(request, service, config);
      if (!auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication required");

      if (auth.transports.includes("web") && writeMethods.has(request.method)) {
        const origin = request.header("origin");
        if (!origin || ![config.WEB_ORIGIN, config.TELEGRAM_ORIGIN].includes(origin)) {
          throw new AppError(403, "ORIGIN_FORBIDDEN", "Invalid request origin");
        }
      }

      (request as AuthenticatedRequest).auth = auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}
