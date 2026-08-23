import net from "node:net";
import { AppError } from "../../../http/errors/app-error.js";

const UNREAD_TTL_SECONDS = 24 * 60 * 60;
const REVEAL_TTL_SECONDS = 60;

type RedisScalar = string | number | null;
type RedisValue = RedisScalar | RedisValue[];

function encodeCommand(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

function parseResp(buffer: Buffer, offset = 0): { value: RedisValue; offset: number } | null {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]!);
  const lineEnd = buffer.indexOf("\r\n", offset + 1);
  if (lineEnd < 0) return null;
  const line = buffer.subarray(offset + 1, lineEnd).toString("utf8");
  const next = lineEnd + 2;

  if (prefix === "+") return { value: line, offset: next };
  if (prefix === ":") return { value: Number(line), offset: next };
  if (prefix === "-") throw new AppError(503, "WHISTLE_REDIS_ERROR", "Whistle transient store rejected the request");
  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    const end = next + length;
    if (buffer.length < end + 2) return null;
    return { value: buffer.subarray(next, end).toString("utf8"), offset: end + 2 };
  }
  if (prefix === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, offset: next };
    const values: RedisValue[] = [];
    let cursor = next;
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(buffer, cursor);
      if (!parsed) return null;
      values.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new AppError(503, "WHISTLE_REDIS_PROTOCOL", "Whistle transient store returned an unsupported response");
}

class RedisConnection {
  constructor(private readonly redisUrl: string) {}

  command(parts: readonly string[]): Promise<RedisValue> {
    const url = new URL(this.redisUrl);
    if (url.protocol !== "redis:") throw new AppError(503, "WHISTLE_REDIS_CONFIG", "Whistle requires a redis:// transient store");
    const port = Number(url.port || 6379);
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port });
      let buffer = Buffer.alloc(0);
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error instanceof AppError ? error : new AppError(503, "WHISTLE_REDIS_UNAVAILABLE", "Whistle transient store is unavailable"));
      };
      socket.setTimeout(3000, () => fail(new AppError(503, "WHISTLE_REDIS_TIMEOUT", "Whistle transient store timed out")));
      socket.once("error", fail);
      socket.once("connect", () => socket.write(encodeCommand(parts)));
      socket.on("data", (chunk: Buffer) => {
        if (settled) return;
        buffer = Buffer.concat([buffer, chunk]);
        try {
          const parsed = parseResp(buffer);
          if (!parsed) return;
          settled = true;
          socket.end();
          resolve(parsed.value);
        } catch (error) {
          fail(error);
        }
      });
    });
  }
}

const REVEAL_SCRIPT = `
local body = redis.call('GET', KEYS[1])
if not body then return {'missing'} end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'visible', body} end
if redis.call('EXISTS', KEYS[3]) == 1 then return {'expired'} end
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 then return {'missing'} end
redis.call('SET', KEYS[3], '1', 'EX', ttl, 'NX')
redis.call('SET', KEYS[2], '1', 'EX', math.min(ARGV[1], ttl), 'NX')
return {'visible', body}
`;

export type RevealResult = { state: "visible"; body: string } | { state: "expired" | "missing" };

export class RedisWhistleStore {
  private readonly redis: RedisConnection;

  constructor(redisUrl: string) {
    this.redis = new RedisConnection(redisUrl);
  }

  private bodyKey(whistleId: string) { return `whistle:body:${whistleId}`; }
  private windowKey(whistleId: string, viewerUserId: string) { return `whistle:reveal:${whistleId}:${viewerUserId}`; }
  private seenKey(whistleId: string, viewerUserId: string) { return `whistle:seen:${whistleId}:${viewerUserId}`; }

  async putBody(whistleId: string, body: string): Promise<void> {
    const result = await this.redis.command(["SET", this.bodyKey(whistleId), body, "EX", String(UNREAD_TTL_SECONDS), "NX"]);
    if (result !== "OK") throw new AppError(503, "WHISTLE_BODY_STORE_FAILED", "Could not store Whistle body");
  }

  async deleteBody(whistleId: string): Promise<void> {
    await this.redis.command(["DEL", this.bodyKey(whistleId)]);
  }

  async reveal(whistleId: string, viewerUserId: string): Promise<RevealResult> {
    const result = await this.redis.command([
      "EVAL", REVEAL_SCRIPT, "3",
      this.bodyKey(whistleId), this.windowKey(whistleId, viewerUserId), this.seenKey(whistleId, viewerUserId),
      String(REVEAL_TTL_SECONDS)
    ]);
    if (!Array.isArray(result) || typeof result[0] !== "string") throw new AppError(503, "WHISTLE_REDIS_PROTOCOL", "Invalid Whistle reveal response");
    if (result[0] === "visible" && typeof result[1] === "string") return { state: "visible", body: result[1] };
    if (result[0] === "expired") return { state: "expired" };
    return { state: "missing" };
  }
}

export const WHISTLE_UNREAD_TTL_SECONDS = UNREAD_TTL_SECONDS;
export const WHISTLE_REVEAL_TTL_SECONDS = REVEAL_TTL_SECONDS;
