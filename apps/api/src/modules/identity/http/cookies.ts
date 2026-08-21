import type { Request, Response } from "express";
import type { ApiConfig } from "@hooma/config";

export function readCookie(request: Request, name: string): string | undefined {
  const raw = request.header("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return undefined;
}

export function setSessionCookie(response: Response, config: ApiConfig, token: string): void {
  response.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1000
  });
}

export function clearSessionCookie(response: Response, config: ApiConfig): void {
  response.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}
