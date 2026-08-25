import net from "node:net";

export type RedisScalar = string | number | null;
export type RedisValue = RedisScalar | RedisValue[];

export type RedisInfrastructureErrorCode =
  | "CONFIG"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "COMMAND"
  | "PROTOCOL";

export class RedisInfrastructureError extends Error {
  constructor(
    readonly code: RedisInfrastructureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RedisInfrastructureError";
  }
}

type PendingCommand = {
  resolve: (value: RedisValue) => void;
  reject: (error: RedisInfrastructureError) => void;
  timeout: NodeJS.Timeout;
};

const COMMAND_TIMEOUT_MS = 3_000;

function encodeCommand(parts: readonly string[]): string {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`;
}

function parseResp(
  buffer: Buffer,
  offset = 0,
): { value: RedisValue; offset: number } | null {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]!);
  const lineEnd = buffer.indexOf("\r\n", offset + 1);
  if (lineEnd < 0) return null;
  const line = buffer.subarray(offset + 1, lineEnd).toString("utf8");
  const next = lineEnd + 2;

  if (prefix === "+") return { value: line, offset: next };
  if (prefix === ":") return { value: Number(line), offset: next };
  if (prefix === "-") {
    throw new RedisInfrastructureError("COMMAND", "Redis rejected the command");
  }
  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, offset: next };
    if (!Number.isInteger(length) || length < 0) {
      throw new RedisInfrastructureError("PROTOCOL", "Invalid Redis bulk response");
    }
    const end = next + length;
    if (buffer.length < end + 2) return null;
    return {
      value: buffer.subarray(next, end).toString("utf8"),
      offset: end + 2,
    };
  }
  if (prefix === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, offset: next };
    if (!Number.isInteger(count) || count < 0) {
      throw new RedisInfrastructureError("PROTOCOL", "Invalid Redis array response");
    }
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

  throw new RedisInfrastructureError("PROTOCOL", "Unsupported Redis response");
}

function unavailableError(): RedisInfrastructureError {
  return new RedisInfrastructureError("UNAVAILABLE", "Redis is unavailable");
}

export class RedisClient {
  private readonly url: URL;
  private socket: net.Socket | null = null;
  private responseBuffer = Buffer.alloc(0);
  private readonly pending: PendingCommand[] = [];
  private ready = false;
  private readyPromise: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
    if (this.url.protocol !== "redis:") {
      throw new RedisInfrastructureError(
        "CONFIG",
        "Redis client requires a redis:// URL",
      );
    }
  }

  async command(parts: readonly string[]): Promise<RedisValue> {
    if (parts.length === 0) {
      throw new RedisInfrastructureError("PROTOCOL", "Redis command cannot be empty");
    }
    await this.ensureReady();
    return this.sendConnected(parts);
  }

  async ping(): Promise<void> {
    const result = await this.command(["PING"]);
    if (result !== "PONG") {
      throw new RedisInfrastructureError(
        "PROTOCOL",
        "Redis PING returned an invalid response",
      );
    }
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    this.readyPromise = null;
    this.responseBuffer = Buffer.alloc(0);
    if (socket && !socket.destroyed) socket.destroy();
    this.rejectPending(unavailableError());
  }

  private ensureReady(): Promise<void> {
    if (this.ready && this.socket && !this.socket.destroyed) {
      return Promise.resolve();
    }
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
    if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
      return Promise.reject(
        new RedisInfrastructureError("CONFIG", "Redis URL contains an invalid port"),
      );
    }

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
        const error = new RedisInfrastructureError("TIMEOUT", "Redis connection timed out");
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
            new RedisInfrastructureError("TIMEOUT", "Redis command timed out"),
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
        error instanceof RedisInfrastructureError
          ? error
          : new RedisInfrastructureError("PROTOCOL", "Invalid Redis response"),
      );
    }
  }

  private failConnection(error: RedisInfrastructureError): void {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    this.responseBuffer = Buffer.alloc(0);
    if (socket && !socket.destroyed) socket.destroy();
    this.rejectPending(error);
  }

  private rejectPending(error: RedisInfrastructureError): void {
    for (const pending of this.pending.splice(0)) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  }
}

let sharedClient: { readonly url: string; readonly client: RedisClient } | null = null;

export function getSharedRedisClient(redisUrl: string): RedisClient {
  if (!sharedClient) {
    sharedClient = { url: redisUrl, client: new RedisClient(redisUrl) };
    return sharedClient.client;
  }
  if (sharedClient.url !== redisUrl) {
    throw new RedisInfrastructureError(
      "CONFIG",
      "API process attempted to initialize more than one Redis endpoint",
    );
  }
  return sharedClient.client;
}

export function closeSharedRedisClient(): void {
  sharedClient?.client.close();
  sharedClient = null;
}
