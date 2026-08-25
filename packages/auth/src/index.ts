import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import type { webcrypto } from "node:crypto";
import * as argon2 from "argon2";
import { deepSnakeToCamelObjKeys, parse, validate } from "@tma.js/init-data-node";

export type AuthTransport = "web" | "telegram";

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly transports: readonly AuthTransport[];
}

export interface TelegramIdentityInput {
  telegramUserId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium?: boolean;
}

type TelegramOidcHeader = {
  readonly alg?: string;
  readonly kid?: string;
};

type TelegramOidcPayload = {
  readonly iss?: string;
  readonly aud?: string | readonly string[];
  readonly exp?: number;
  readonly nbf?: number;
  readonly nonce?: string;
  readonly id?: string | number;
  readonly preferred_username?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly picture?: string;
};

type TelegramJwk = webcrypto.JsonWebKey & {
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
};

const TELEGRAM_OIDC_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_JWKS_URL = `${TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json`;
const TELEGRAM_JWKS_CACHE_MS = 5 * 60_000;
let telegramJwksCache: {
  readonly keys: readonly TelegramJwk[];
  readonly expiresAt: number;
} | null = null;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  expiresInSeconds: number,
): TelegramIdentityInput {
  validate(rawInitData, botToken, { expiresIn: expiresInSeconds });
  const data = deepSnakeToCamelObjKeys(parse(rawInitData));
  const user = data.user;
  if (!user) throw new Error("Telegram initData does not contain a user");

  return {
    telegramUserId: BigInt(String(user.id)),
    ...(user.username ? { username: user.username } : {}),
    ...(user.firstName ? { firstName: user.firstName } : {}),
    ...(user.lastName ? { lastName: user.lastName } : {}),
    ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
    ...(user.languageCode ? { languageCode: user.languageCode } : {}),
    ...(user.isPremium !== undefined ? { isPremium: user.isPremium } : {}),
  };
}

export async function validateTelegramOidcIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
): Promise<TelegramIdentityInput> {
  const segments = idToken.split(".");
  if (segments.length !== 3) throw new Error("Invalid Telegram ID token");
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid Telegram ID token");
  }

  const header = parseJwtJson<TelegramOidcHeader>(encodedHeader);
  const payload = parseJwtJson<TelegramOidcPayload>(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Telegram ID token signature");
  }

  const key = (await telegramJwks()).find(
    (candidate) =>
      candidate.kid === header.kid &&
      (!candidate.alg || candidate.alg === "RS256") &&
      (!candidate.use || candidate.use === "sig"),
  );
  if (!key) throw new Error("Telegram signing key not found");

  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("Invalid Telegram ID token signature");

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.iss !== TELEGRAM_OIDC_ISSUER) {
    throw new Error("Invalid Telegram ID token issuer");
  }
  if (!audienceContains(payload.aud, clientId)) {
    throw new Error("Invalid Telegram ID token audience");
  }
  if (!payload.exp || payload.exp <= nowSeconds) {
    throw new Error("Expired Telegram ID token");
  }
  if (payload.nbf !== undefined && payload.nbf > nowSeconds + 60) {
    throw new Error("Telegram ID token is not active yet");
  }
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new Error("Invalid Telegram ID token nonce");
  }
  if (payload.id === undefined || payload.id === null) {
    throw new Error("Telegram ID token does not contain a user ID");
  }

  return {
    telegramUserId: BigInt(String(payload.id)),
    ...(payload.preferred_username ? { username: payload.preferred_username } : {}),
    ...(payload.given_name ? { firstName: payload.given_name } : {}),
    ...(payload.family_name ? { lastName: payload.family_name } : {}),
    ...(payload.picture ? { photoUrl: payload.picture } : {}),
  };
}

function parseJwtJson<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("Invalid Telegram ID token payload");
  }
}

function audienceContains(
  audience: string | readonly string[] | undefined,
  clientId: string,
): boolean {
  return Array.isArray(audience) ? audience.includes(clientId) : audience === clientId;
}

async function telegramJwks(): Promise<readonly TelegramJwk[]> {
  if (telegramJwksCache && telegramJwksCache.expiresAt > Date.now()) {
    return telegramJwksCache.keys;
  }
  const response = await fetch(TELEGRAM_JWKS_URL, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Unable to load Telegram signing keys");
  const body = (await response.json()) as { keys?: TelegramJwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Telegram signing keys are unavailable");
  }
  telegramJwksCache = {
    keys: body.keys,
    expiresAt: Date.now() + TELEGRAM_JWKS_CACHE_MS,
  };
  return body.keys;
}
