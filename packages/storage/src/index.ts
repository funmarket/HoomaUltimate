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

export type S3ObjectStorageConfig = {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
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

function canonicalObjectPath(bucket: string, key: string): string {
  return `/${encodePathSegment(bucket)}/${key.split("/").map(encodePathSegment).join("/")}`;
}

export class S3ObjectStorage implements ObjectStorage {
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
    const canonicalUri = canonicalObjectPath(this.config.bucket, key);
    const host = this.endpoint.host;
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
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      await sha256(canonicalRequest),
    ].join("\n");
    const dateKey = await hmac(
      new TextEncoder().encode(`AWS4${this.config.secretAccessKey}`),
      shortDate,
    );
    const regionKey = await hmac(dateKey, this.config.region);
    const serviceKey = await hmac(regionKey, "s3");
    const signingKey = await hmac(serviceKey, "aws4_request");
    const signature = hex(await hmac(signingKey, stringToSign));
    const url = new URL(canonicalUri, this.endpoint);
    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      ...(body ? { body } : {}),
    });
    if (!response.ok) {
      throw new Error(`Object storage ${method} failed (${response.status})`);
    }
    return response;
  }
}
