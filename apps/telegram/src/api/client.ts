import type { MeResponse } from "@hooma/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function telegramMe(initData: string): Promise<MeResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
    credentials: "include",
    headers: { authorization: `tma ${initData}` }
  });
  const body = (await response.json().catch(() => ({}))) as MeResponse & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}
