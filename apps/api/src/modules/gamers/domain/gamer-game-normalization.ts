export function normalizeGamerGameName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

export function gamerGameSlug(normalizedName: string): string {
  return normalizedName.replace(/\s+/g, "-");
}
