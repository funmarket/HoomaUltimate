export function normalizeOrigin(value) {
  if (!value) return null;
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return normalized.replace(/\/$/, "");
}

export function resolveWebApiOrigin(environment = process.env) {
  const apiOrigin = normalizeOrigin(environment.HOOMA_API_ORIGIN);
  if (environment.NODE_ENV === "production" && !apiOrigin) {
    throw new Error("HOOMA_API_ORIGIN is required in production");
  }
  return apiOrigin;
}
