import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "../../../http/errors/app-error.js";
import type { ExternalPlaceImageResolver } from "../application/external-place-image-resolver.js";
import { normalizeExternalPlaceImageUrl } from "../boundary/external-place-image-url.js";

const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 6_000;
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;

type HostAddress = { readonly address: string; readonly family: number };
type HostLookup = (hostname: string) => Promise<readonly HostAddress[]>;
type Fetcher = typeof fetch;

function imageError(message: string): AppError {
  return new AppError(422, "PLACE_IMAGE_URL_UNRESOLVABLE", message);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a = 0, b = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff")) return true;
  if (/^fe[89ab]/.test(value) || value.startsWith("2001:db8:")) return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  );
}

async function defaultHostLookup(hostname: string): Promise<readonly HostAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function parseHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw imageError("Place photo link is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw imageError("Place photo links must use http or https");
  }
  if (url.username || url.password) {
    throw imageError("Place photo links cannot contain credentials");
  }
  return url;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function tagAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) attributes.set(name, decodeHtml(value));
  }
  return attributes;
}

function metadataImage(html: string, pageUrl: URL): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0]);
    const key = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
    if (!["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key)) continue;
    const content = attributes.get("content")?.trim();
    if (content) return new URL(content, pageUrl).toString();
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0]);
    if ((attributes.get("rel") ?? "").toLowerCase() !== "image_src") continue;
    const href = attributes.get("href")?.trim();
    if (href) return new URL(href, pageUrl).toString();
  }
  return null;
}

function googleResultImage(html: string): string | null {
  const decoded = decodeHtml(html)
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\\//g, "/");

  for (const match of decoded.matchAll(/(?:[?&]|\b)(?:imgurl|mediaurl|image_url)=([^&"'<>\s]+)/gi)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const candidate = decodeURIComponent(raw);
      const url = parseHttpUrl(candidate);
      if (!GOOGLE_HOST.test(url.hostname)) return url.toString();
    } catch {
      // Continue to the next candidate.
    }
  }

  for (const match of decoded.matchAll(/https?:\/\/[^\s"'<>\\]+\.(?:avif|gif|jpe?g|png|webp)(?:\?[^\s"'<>\\]*)?/gi)) {
    const candidate = match[0];
    try {
      const url = parseHttpUrl(candidate);
      if (!GOOGLE_HOST.test(url.hostname)) return url.toString();
    } catch {
      // Continue to the next candidate.
    }
  }
  return null;
}

async function readHtml(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw imageError("Place photo page is too large to inspect safely");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export class HttpExternalPlaceImageResolver implements ExternalPlaceImageResolver {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly hostLookup: HostLookup = defaultHostLookup,
  ) {}

  async resolve(value: string): Promise<string> {
    const normalized = normalizeExternalPlaceImageUrl(value);
    let current = parseHttpUrl(normalized);
    await this.assertPublicUrl(current);

    if (IMAGE_EXTENSION.test(current.pathname)) return current.toString();

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const response = await this.fetch(current);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          throw imageError("Place photo link has too many redirects");
        }
        current = new URL(location, current);
        await this.assertPublicUrl(current);
        if (IMAGE_EXTENSION.test(current.pathname)) return current.toString();
        continue;
      }

      if (!response.ok) {
        throw imageError(`Place photo link returned HTTP ${response.status}`);
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (contentType.startsWith("image/")) return current.toString();
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw imageError("Place photo link does not return an image or image page");
      }

      const html = await readHtml(response);
      const candidate = metadataImage(html, current) ?? (GOOGLE_HOST.test(current.hostname) ? googleResultImage(html) : null);
      if (!candidate) {
        throw imageError("No displayable photo was found at this link");
      }
      const image = parseHttpUrl(normalizeExternalPlaceImageUrl(candidate));
      await this.assertPublicUrl(image);
      return image.toString();
    }

    throw imageError("Place photo link could not be resolved");
  }

  private async fetch(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await this.fetcher(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/*,text/html;q=0.9,*/*;q=0.2",
          "user-agent": "HOOMA-PlaceImageResolver/1.0",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw imageError("Place photo link timed out");
      }
      throw imageError("Place photo link could not be reached");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertPublicUrl(url: URL): Promise<void> {
    if (blockedHostname(url.hostname)) throw imageError("Private or internal photo hosts are not allowed");
    if (isIP(url.hostname)) {
      if (isPrivateAddress(url.hostname)) throw imageError("Private or internal photo hosts are not allowed");
      return;
    }

    let addresses: readonly HostAddress[];
    try {
      addresses = await this.hostLookup(url.hostname);
    } catch {
      throw imageError("Place photo host could not be resolved");
    }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw imageError("Private or internal photo hosts are not allowed");
    }
  }
}
