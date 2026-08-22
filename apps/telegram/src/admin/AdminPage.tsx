import { useEffect, useState } from "react";
import { telegramAdminOverview, type TelegramAdminOverview } from "../api/client";

export function AdminPage({ initData }: { readonly initData: string }) {
  const [overview, setOverview] = useState<TelegramAdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initData) {
      setError("Telegram authentication is required for App Admin.");
      return;
    }
    void telegramAdminOverview(initData).then(setOverview).catch((reason: Error) => setError(reason.message));
  }, [initData]);

  return (
    <section className="auth-card">
      <p className="eyebrow">APP ADMIN</p>
      <h2>HOOMA Control Room</h2>
      {overview ? (
        <dl>
          <div><dt>Users</dt><dd>{overview.users}</dd></div>
          <div><dt>Platform Admins</dt><dd>{overview.activePlatformAdmins}</dd></div>
          <div><dt>Audit entries</dt><dd>{overview.auditEntries}</dd></div>
        </dl>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
