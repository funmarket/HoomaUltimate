import net from "node:net";
import { AppError } from "../../../http/errors/app-error.js";
import type { WhistleTransientStore } from "../application/whistle.store.js";

type RedisScalar = string | number | null;
type RedisValue = RedisScalar | RedisValue[];

type PendingCommand = {
  resolve: (value: RedisValue) => void;
  reject: (error: AppError) => void;
  timeout: NodeJS.Timeout;
};

const COMMAND_TIMEOUT_MS = 3_000;

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
  if (prefix === "-")
    throw new AppError(503, "WHISTLE_REDIS_ERROR", "Whistle transient store rejected the request");
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
  throw new AppError(
    503,
    "WHISTLE_REDIS_PROTOCOL",
    "Whistle transient store returned an unsupported response",
  );
}

function unavailableError(): AppError {
  return new AppError(503, "WHISTLE_REDIS_UNAVAILABLE", "Whistle transient store is unavailable");
}

class RedisConnection {
  private readonly url: URL;
  private socket: net.Socket | null = null;
  private responseBuffer = Buffer.alloc(0);
  private readonly pending: PendingCommand[] = [];
  private ready = false;
  private readyPromise: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
    if (this.url.protocol !== "redis:")
      throw new AppError(
        503,
        "WHISTLE_REDIS_CONFIG",
        "Whistle requires a redis:// transient store",
      );
  }

  async command(parts: readonly string[]): Promise<RedisValue> {
    await this.ensureReady();
    return this.sendConnected(parts);
  }

  private ensureReady(): Promise<void> {
    if (this.ready && this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = this.openAndInitialize().finally(() => {
      this.readyPromise = null;
    });
    return this.readyPromise;
  }

  private async openAndInitialize(): Promise<void> {
    await this.openSocket();

    const password = decodeURIComponent(this.url.password);
    if (password) {
      const username = decodeURIComponent(this.url.username);
      const auth = username ? ["AUTH", username, password] : ["AUTH", password];
      const result = await this.sendConnected(auth);
      if (result !== "OK") throw unavailableError();
    }

    const database = this.url.pathname.replace(/^\//, "");
    if (database && database !== "0") {
      const result = await this.sendConnected(["SELECT", database]);
      if (result !== "OK") throw unavailableError();
    }

    this.ready = true;
  }

  private openSocket(): Promise<void> {
    const port = Number(this.url.port || 6379);
    const socket = net.createConnection({ host: this.url.hostname, port });
    this.socket = socket;
    this.responseBuffer = Buffer.alloc(0);
    this.ready = false;
    socket.setKeepAlive(true, 30_000);
    socket.unref();

    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("error", () => this.failConnection(unavailableError()));
    socket.on("close", () => {
      if (this.socket === socket) this.failConnection(unavailableError());
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      const connectTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new AppError(
          503,
          "WHISTLE_REDIS_TIMEOUT",
          "Whistle transient store timed out",
        );
        this.failConnection(error);
        reject(error);
      }, COMMAND_TIMEOUT_MS);

      socket.once("connect", () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        resolve();
      });
      socket.once("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        reject(unavailableError());
      });
    });
  }

  private sendConnected(parts: readonly string[]): Promise<RedisValue> {
    const socket = this.socket;
    if (!socket || socket.destroyed) return Promise.reject(unavailableError());

    return new Promise((resolve, reject) => {
      const pending: PendingCommand = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.failConnection(
            new AppError(503, "WHISTLE_REDIS_TIMEOUT", "Whistle transient store timed out"),
          );
        }, COMMAND_TIMEOUT_MS),
      };
      this.pending.push(pending);
      socket.write(encodeCommand(parts), (error) => {
        if (error) this.failConnection(unavailableError());
      });
    });
  }

  private onData(chunk: Buffer): void {
    this.responseBuffer = Buffer.concat([this.responseBuffer, chunk]);

    try {
      while (this.pending.length > 0) {
        const parsed = parseResp(this.responseBuffer);
        if (!parsed) return;

        this.responseBuffer = this.responseBuffer.subarray(parsed.offset);
        const pending = this.pending.shift()!;
        clearTimeout(pending.timeout);
        pending.resolve(parsed.value);
      }
    } catch (error) {
      this.failConnection(
        error instanceof AppError
          ? error
          : new AppError(
              503,
              "WHISTLE_REDIS_PROTOCOL",
              "Whistle transient store returned an invalid response",
            ),
      );
    }
  }

  private failConnection(error: AppError): void {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    this.responseBuffer = Buffer.alloc(0);
    if (socket && !socket.destroyed) socket.destroy();

    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  }
}

export class RedisWhistleStore implements WhistleTransientStore {
  private readonly redis: RedisConnection;

  constructor(redisUrl: string) {
    this.redis = new RedisConnection(redisUrl);
  }

  private bodyKey(whistleId: string) {
    return `whistle:body:${whistleId}`;
  }

  async putBody(whistleId: string, body: string, expiresInMilliseconds: number): Promise<void> {
    const ttl = Math.max(1, Math.floor(expiresInMilliseconds));
    const result = await this.redis.command([
      "SET",
      this.bodyKey(whistleId),
      body,
      "PX",
      String(ttl),
      "NX",
    ]);
    if (result !== "OK")
      throw new AppError(503, "WHISTLE_BODY_STORE_FAILED", "Could not store Whistle body");
  }

  async getBodies(whistleIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (whistleIds.length === 0) return new Map();

    const result = await this.redis.command([
      "MGET",
      ...whistleIds.map((whistleId) => this.bodyKey(whistleId)),
    ]);
    if (!Array.isArray(result) || result.length !== whistleIds.length)
      throw new AppError(503, "WHISTLE_REDIS_PROTOCOL", "Invalid Whistle body response");

    const bodies = new Map<string, string>();
    for (let index = 0; index < whistleIds.length; index += 1) {
      const body = result[index];
      if (body === null) continue;
      if (typeof body !== "string")
        throw new AppError(503, "WHISTLE_REDIS_PROTOCOL", "Invalid Whistle body response");
      bodies.set(whistleIds[index]!, body);
    }
    return bodies;
  }

  async deleteBody(whistleId: string): Promise<void> {
    await this.redis.command(["DEL", this.bodyKey(whistleId)]);
  }
}
