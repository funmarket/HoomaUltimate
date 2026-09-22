/**
 * Surfaces the canonical Requests pages serve.
 *
 * A surface is a presentation context only: it chooses which taxonomy surface
 * classifies a Request and where the requester returns afterwards. It never
 * changes the Request model — one canonical `HelpRequest` is listed with
 * `surface=<SURFACE>` and server-side eligibility stays authoritative.
 */
export const REQUEST_SURFACES = {
  REQUESTS: { returnHref: "/requests", returnLabel: "Back to Requests" },
  PLAY: { returnHref: "/play", returnLabel: "Back to Play" },
  ATHLETES: { returnHref: "/athletes", returnLabel: "Back to Athletes" },
} as const;

export type RequestSurface = keyof typeof REQUEST_SURFACES;

/** `?surface=` defaults to the Requests surface; unknown values are ignored. */
export function resolveRequestSurface(): RequestSurface {
  if (typeof window === "undefined") return "REQUESTS";
  const requested = new URLSearchParams(window.location.search).get("surface");
  if (!requested) return "REQUESTS";
  const normalized = requested.toUpperCase();
  return normalized in REQUEST_SURFACES ? (normalized as RequestSurface) : "REQUESTS";
}
