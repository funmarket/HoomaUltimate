export interface StoredObjectDescriptor {
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface StoredObject extends StoredObjectDescriptor {
  readonly body: Uint8Array;
}

export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor>;
  get(key: string): Promise<StoredObject>;
  remove(key: string): Promise<void>;
}

export interface ObjectStorageReadUrlSigner {
  createReadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export type S3ObjectStorageConfig = {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly urlStyle?: "path" | "virtual";
};

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", copyArrayBuffer(bytes)));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const rawKey = key instanceof ArrayBuffer ? key : copyArrayBuffer(key);
  const imported = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", imported, new TextEncoder().encode(value));
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function awsEncode(value: string): string {
  return encodePathSegment(value).replace(/%7E/g, "~");
}

function encodedKeyPath(key: string): string {
  return `/${key.split("/").map(encodePathSegment).join("/")}`;
}

function objectRequestUrl(
  endpoint: URL,
  bucket: string,
  key: string,
  urlStyle: "path" | "virtual",
): URL {
  const url = new URL(endpoint);
  const keyPath = encodedKeyPath(key);

  if (urlStyle === "virtual") {
    url.hostname = `${bucket}.${endpoint.hostname}`;
    url.pathname = keyPath;
  } else {
    url.pathname = `/${encodePathSegment(bucket)}${keyPath}`;
  }

  url.search = "";
  url.hash = "";
  return url;
}

function canonicalQuery(parameters: Readonly<Record<string, string>>): string {
  return Object.entries(parameters)
    .map(([name, value]) => [awsEncode(name), awsEncode(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

export class S3ObjectStorage implements ObjectStorage, ObjectStorageReadUrlSigner {
  private readonly endpoint: URL;

  constructor(private readonly config: S3ObjectStorageConfig) {
    this.endpoint = new URL(config.endpoint);
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor> {
    await this.request("PUT", key, body, contentType);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<StoredObject> {
    const response = await this.request("GET", key);
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      key,
      body,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      sizeBytes: body.byteLength,
    };
  }

  async remove(key: string): Promise<void> {
    await this.request("DELETE", key);
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 3600) {
      throw new Error("Object storage read URL expiry must be between 1 and 3600 seconds");
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const shortDate = amzDate.slice(0, 8);
    const scope = `${shortDate}/${this.config.region}/s3/aws4_request`;
    const url = objectRequestUrl(
      this.endpoint,
      this.config.bucket,
      key,
      this.config.urlStyle ?? "path",
    );
    const host = url.host;
    const parameters = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.config.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-SignedHeaders": "host",
    };
    const query = canonicalQuery(parameters);
    const canonicalRequest = [
      "GET",
      url.pathname,
      query,
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join(
      "\n",
    );
    const signingKey = await this.signingKey(shortDate);
    const signature = hex(await hmac(signingKey, stringToSign));
    url.search = `${query}&X-Amz-Signature=${signature}`;
    return url.toString();
  }

  private async signingKey(shortDate: string): Promise<ArrayBuffer> {
    const dateKey = await hmac(
      new TextEncoder().encode(`AWS4${this.config.secretAccessKey}`),
      shortDate,
    );
    const regionKey = await hmac(dateKey, this.config.region);
    const serviceKey = await hmac(regionKey, "s3");
    return hmac(serviceKey, "aws4_request");
  }

  private async request(
    method: "GET" | "PUT" | "DELETE",
    key: string,
    body?: Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const shortDate = amzDate.slice(0, 8);
    const payloadHash = await sha256(body ?? new Uint8Array());
    const url = objectRequestUrl(
      this.endpoint,
      this.config.bucket,
      key,
      this.config.urlStyle ?? "path",
    );
    const canonicalUri = url.pathname;
    const host = url.host;
    const headers: Record<string, string> = {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["content-type"] = contentType;
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name]!.trim()}\n`)
      .join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
      method,
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${shortDate}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join(
      "\n",
    );
    const signingKey = await this.signingKey(shortDate);
    const signature = hex(await hmac(signingKey, stringToSign));
    const requestInit: RequestInit = {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    };
    if (body) requestInit.body = copyArrayBuffer(body);
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      throw new Error(`Object storage ${method} failed (${response.status})`);
    }
    return response;
  }
}
