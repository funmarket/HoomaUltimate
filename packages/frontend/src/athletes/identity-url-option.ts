export function externalIdentityUrl(
  mode: "none" | "external",
  value: string | null,
): string | null {
  if (mode === "none") return null;
  const url = value?.trim() ?? "";
  return url || null;
}
