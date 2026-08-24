export class HoomaApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HoomaApiError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export type HoomaTransport = {
  readonly baseUrl: string;
  readonly credentials?: RequestCredentials;
  readonly getHeaders?: () => HeadersInit;
  readonly onAuthenticationRequired?: () => void;
  readonly authenticationHref?: (returnTo: string) => string | null;
};

export async function request<T>(
  transport: HoomaTransport,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${transport.baseUrl}${path}`, {
    ...init,
    ...(transport.credentials ? { credentials: transport.credentials } : {}),
    headers: {
      "content-type": "application/json",
      ...(transport.getHeaders?.() ?? {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new HoomaApiError(
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.code,
    );
  }
  return body;
}
