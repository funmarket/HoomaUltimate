const GOOGLE_IMAGE_TARGET_PARAMS = ["imgurl", "mediaurl", "image_url"] as const;

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

function embeddedGoogleImageTarget(url: URL): string | null {
  if (!isGoogleSearchHost(url.hostname)) return null;

  for (const parameter of GOOGLE_IMAGE_TARGET_PARAMS) {
    const candidate = url.searchParams.get(parameter)?.trim();
    if (candidate && isHttpUrl(candidate)) return candidate;
  }

  if (url.pathname === "/url") {
    for (const parameter of ["url", "q"] as const) {
      const candidate = url.searchParams.get(parameter)?.trim();
      if (candidate && isHttpUrl(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Keep ordinary direct image URLs byte-for-byte intact while unwrapping Google
 * image-result/redirect links that explicitly contain the real remote image URL.
 *
 * A generic Google Images search page has no single image identity and therefore
 * cannot be deterministically converted without scraping search results.
 */
export function normalizeExternalPlaceImageUrl(value: string): string {
  let current = value.trim();

  for (let depth = 0; depth < 4; depth += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return current;
    }

    const target = embeddedGoogleImageTarget(parsed);
    if (!target || target === current) return current;
    current = target;
  }

  return current;
}
