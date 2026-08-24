export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function defaultDisplayName(
  displayName: string | null | undefined,
  displayUsername: string,
): string {
  const normalized = displayName?.trim();
  return normalized || displayUsername.trim();
}
