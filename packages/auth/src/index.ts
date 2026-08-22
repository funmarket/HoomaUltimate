import { createHash, randomBytes } from "node:crypto";
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

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
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
  expiresInSeconds: number
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
    ...(user.isPremium !== undefined ? { isPremium: user.isPremium } : {})
  };
}
