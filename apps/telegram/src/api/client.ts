const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function telegramRequest<T>(initData: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      authorization: `tma ${initData}`,
      ...init?.headers
    }
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

export type TelegramAdminOverview = {
  users: number;
  activePlatformAdmins: number;
  auditEntries: number;
};

export function telegramAdminOverview(initData: string): Promise<TelegramAdminOverview> {
  return telegramRequest<TelegramAdminOverview>(initData, "/api/v1/admin/overview");
}
