import type { LoginInput, MeResponse, RegisterInput } from "@hooma/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

async function optionalMe(): Promise<MeResponse | null> {
  const response = await fetch(`${apiBaseUrl}/api/v1/me`, { credentials: "include" });
  if (response.status === 401) return null;
  const body = (await response.json().catch(() => ({}))) as MeResponse & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

export const webApi = {
  register(input: RegisterInput) {
    return request<{ ok: true }>("/api/public/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  login(input: LoginInput) {
    return request<{ ok: true }>("/api/public/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  me() {
    return request<MeResponse>("/api/v1/me");
  },
  meOptional: optionalMe,
  logout() {
    return request<{ ok: true }>("/api/v1/auth/logout", { method: "POST" });
  }
};
