type ApiError = Error & { code?: string };

export function redirectIfAuthenticationRequired(reason: unknown): boolean {
  const error = reason as Partial<ApiError>;
  if (error?.code !== "AUTH_REQUIRED") return false;

  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return true;
}

export function protectedActionError(reason: unknown, fallback: string): string {
  if (redirectIfAuthenticationRequired(reason)) return "";
  return reason instanceof Error ? reason.message : fallback;
}
