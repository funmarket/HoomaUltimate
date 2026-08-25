import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import {
  validateTelegramOidcIdToken,
  type TelegramIdentityInput,
} from "@hooma/auth";
import type { ApiConfig } from "@hooma/config";
import { AppError } from "../../../http/errors/app-error.js";

const FLOW_COOKIE = "hooma_telegram_login";
const FLOW_TTL_MS = 10 * 60_000;
const AUTHORIZATION_URL = "https://oauth.telegram.org/auth";
const TOKEN_URL = "https://oauth.telegram.org/token";

type FlowMode = "login" | "link";

type TelegramWebFlow = {
  readonly mode: FlowMode;
  readonly state: string;
  readonly verifier: string;
  readonly nonce: string;
  readonly returnTo: string;
  readonly userId?: string;
  readonly expiresAt: number;
};

export function telegramWebLoginConfigured(config: ApiConfig): boolean {
  return Boolean(
    config.TELEGRAM_LOGIN_CLIENT_ID &&
      config.TELEGRAM_LOGIN_CLIENT_SECRET &&
      config.TELEGRAM_LOGIN_REDIRECT_URI,
  );
}

export function beginTelegramWebFlow(
  response: Response,
  config: ApiConfig,
  input: {
    readonly mode: FlowMode;
    readonly returnTo: string;
    readonly userId?: string;
  },
): string | null {
  if (
    !telegramWebLoginConfigured(config) ||
    !config.TELEGRAM_LOGIN_REDIRECT_URI
  ) {
    return null;
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const flow: TelegramWebFlow = {
    mode: input.mode,
    state,
    verifier,
    nonce,
    returnTo: safeReturnTo(input.returnTo),
    ...(input.userId ? { userId: input.userId } : {}),
    expiresAt: Date.now() + FLOW_TTL_MS,
  };
  setFlowCookie(response, config, flow);

  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set("client_id", config.TELEGRAM_LOGIN_CLIENT_ID);
  url.searchParams.set("redirect_uri", config.TELEGRAM_LOGIN_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", sha256Base64Url(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function readTelegramWebFlow(
  request: Request,
  config: ApiConfig,
): TelegramWebFlow {
  if (!telegramWebLoginConfigured(config)) {
    throw new AppError(
      503,
      "TELEGRAM_WEB_LOGIN_DISABLED",
      "Telegram Web login is not configured",
    );
  }
  const rawCookie = readNamedCookie(request, FLOW_COOKIE);
  if (!rawCookie) throw invalidFlow();
  const [payload, signature] = rawCookie.split(".", 2);
  if (!payload || !signature) throw invalidFlow();
  const expected = flowSignature(
    payload,
    config.TELEGRAM_LOGIN_CLIENT_SECRET,
  );
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw invalidFlow();
  }
  try {
    const flow = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as TelegramWebFlow;
    if (
      (flow.mode !== "login" && flow.mode !== "link") ||
      !flow.state ||
      !flow.verifier ||
      !flow.nonce ||
      !flow.returnTo ||
      !flow.expiresAt ||
      flow.expiresAt <= Date.now() ||
      (flow.mode === "link" && !flow.userId)
    ) {
      throw invalidFlow();
    }
    return flow;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalidFlow();
  }
}

export function clearTelegramWebFlow(
  response: Response,
  config: ApiConfig,
): void {
  response.clearCookie(FLOW_COOKIE, flowCookieOptions(config));
}

export async function completeTelegramWebFlow(
  request: Request,
  config: ApiConfig,
  flow: TelegramWebFlow,
): Promise<TelegramIdentityInput> {
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state =
    typeof request.query.state === "string" ? request.query.state : "";
  if (
    !code ||
    !state ||
    state !== flow.state ||
    !config.TELEGRAM_LOGIN_REDIRECT_URI
  ) {
    throw invalidFlow();
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(
        `${config.TELEGRAM_LOGIN_CLIENT_ID}:${config.TELEGRAM_LOGIN_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.TELEGRAM_LOGIN_REDIRECT_URI,
      client_id: config.TELEGRAM_LOGIN_CLIENT_ID,
      code_verifier: flow.verifier,
    }),
  });
  if (!tokenResponse.ok) {
    throw new AppError(
      401,
      "TELEGRAM_WEB_LOGIN_INVALID",
      "Telegram login could not be verified",
    );
  }
  const body = (await tokenResponse.json()) as { id_token?: string };
  if (!body.id_token) {
    throw new AppError(
      401,
      "TELEGRAM_WEB_LOGIN_INVALID",
      "Telegram did not return an ID token",
    );
  }
  try {
    return await validateTelegramOidcIdToken(
      body.id_token,
      config.TELEGRAM_LOGIN_CLIENT_ID,
      flow.nonce,
    );
  } catch {
    throw new AppError(
      401,
      "TELEGRAM_WEB_LOGIN_INVALID",
      "Telegram login could not be verified",
    );
  }
}

export function webRedirect(
  config: ApiConfig,
  returnTo: string,
  params?: Record<string, string>,
): string {
  const url = new URL(safeReturnTo(returnTo), config.WEB_ORIGIN);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function setFlowCookie(
  response: Response,
  config: ApiConfig,
  flow: TelegramWebFlow,
): void {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  response.cookie(
    FLOW_COOKIE,
    `${payload}.${flowSignature(
      payload,
      config.TELEGRAM_LOGIN_CLIENT_SECRET,
    )}`,
    {
      ...flowCookieOptions(config),
      maxAge: FLOW_TTL_MS,
    },
  );
}

function flowCookieOptions(config: ApiConfig) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/public/v1/auth/telegram/web/callback",
  };
}

function flowSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function safeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function readNamedCookie(request: Request, name: string): string | undefined {
  const raw = request.header("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return undefined;
}

function invalidFlow(): AppError {
  return new AppError(
    401,
    "TELEGRAM_WEB_FLOW_INVALID",
    "Telegram login flow is invalid or expired",
  );
}
