import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 6_000;
const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const GOOGLE_IMAGE_TARGET_PARAMS = ["imgurl", "mediaurl", "image_url"] as const;

type HostAddress = { readonly address: string; readonly family: number };
export type ExternalImageHostLookup = (hostname: string) => Promise<readonly HostAddress[]>;
export type ExternalImageFetcher = typeof fetch;

export class ExternalImageResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalImageResolutionError";
  }
}

function imageError(message: string): ExternalImageResolutionError {
  return new ExternalImageResolutionError(message);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a = 0, b = 0, c = 0] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
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
    throw imageError("Image link is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw imageError("Image links must use http or https");
  }
  if (url.username || url.password) {
    throw imageError("Image links cannot contain credentials");
  }
  return url;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGoogleSearchHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === "google.com" || host.startsWith("google.") || host.endsWith(".google.com");
}

function unwrapGoogleImageTarget(value: string): string {
  let current = value.trim();
  for (let depth = 0; depth < 4; depth += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return current;
    }
    if (!isGoogleSearchHost(parsed.hostname)) return current;

    let target: string | null = null;
    for (const parameter of GOOGLE_IMAGE_TARGET_PARAMS) {
      const candidate = parsed.searchParams.get(parameter)?.trim();
      if (candidate && isHttpUrl(candidate)) {
        target = candidate;
        break;
      }
    }
    if (!target && parsed.pathname === "/url") {
      for (const parameter of ["url", "q"] as const) {
        const candidate = parsed.searchParams.get(parameter)?.trim();
        if (candidate && isHttpUrl(candidate)) {
          target = candidate;
          break;
        }
      }
    }
    if (!target || target === current) return current;
    current = target;
  }
  return current;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
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

  for (const match of decoded.matchAll(
    /(?:[?&]|\b)(?:imgurl|mediaurl|image_url)=([^&"'<>\s]+)/gi,
  )) {
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

  for (const match of decoded.matchAll(
    /https?:\/\/[^\s"'<>\\]+\.(?:avif|gif|jpe?g|png|webp)(?:\?[^\s"'<>\\]*)?/gi,
  )) {
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
      throw imageError("Image page is too large to inspect safely");
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

export class HttpExternalImageResolver {
  constructor(
    private readonly fetcher: ExternalImageFetcher = fetch,
    private readonly hostLookup: ExternalImageHostLookup = defaultHostLookup,
    private readonly userAgent = "HOOMA-ExternalImageResolver/1.0",
  ) {}

  async resolve(value: string): Promise<string> {
    const initial = parseHttpUrl(unwrapGoogleImageTarget(value));
    const page = await this.fetchFollowingRedirects(initial);
    const contentType = (page.response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.startsWith("image/")) {
      await page.response.body?.cancel();
      return page.url.toString();
    }
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      await page.response.body?.cancel();
      throw imageError("Image link does not return an image or image page");
    }

    const html = await readHtml(page.response);
    const candidate =
      metadataImage(html, page.url) ??
      (GOOGLE_HOST.test(page.url.hostname) ? googleResultImage(html) : null);
    if (!candidate) throw imageError("No displayable image was found at this link");

    const image = await this.fetchFollowingRedirects(parseHttpUrl(unwrapGoogleImageTarget(candidate)));
    const candidateType = (image.response.headers.get("content-type") ?? "").toLowerCase();
    await image.response.body?.cancel();
    if (!candidateType.startsWith("image/")) {
      throw imageError("Resolved image link does not return an image");
    }
    return image.url.toString();
  }

  private async fetchFollowingRedirects(
    start: URL,
  ): Promise<{ readonly url: URL; readonly response: Response }> {
    let current = start;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      await this.assertPublicUrl(current);
      const response = await this.fetchUrl(current);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === MAX_REDIRECTS) {
          throw imageError("Image link has too many redirects");
        }
        current = parseHttpUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw imageError(`Image link returned HTTP ${response.status}`);
      }
      return { url: current, response };
    }
    throw imageError("Image link could not be resolved");
  }

  private async fetchUrl(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await this.fetcher(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/*,text/html;q=0.9,*/*;q=0.2",
          "user-agent": this.userAgent,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw imageError("Image link timed out");
      }
      if (error instanceof ExternalImageResolutionError) throw error;
      throw imageError("Image link could not be reached");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async assertPublicUrl(url: URL): Promise<void> {
    if (blockedHostname(url.hostname)) {
      throw imageError("Private or internal image hosts are not allowed");
    }
    if (isIP(url.hostname)) {
      if (isPrivateAddress(url.hostname)) {
        throw imageError("Private or internal image hosts are not allowed");
      }
      return;
    }

    let addresses: readonly HostAddress[];
    try {
      addresses = await this.hostLookup(url.hostname);
    } catch {
      throw imageError("Image host could not be resolved");
    }
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw imageError("Private or internal image hosts are not allowed");
    }
  }
}
