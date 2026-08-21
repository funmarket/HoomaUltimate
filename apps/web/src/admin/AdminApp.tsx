import { useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type Overview = { users: number; activePlatformAdmins: number; auditEntries: number };

export function AdminApp() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`${apiBaseUrl}/api/v1/admin/overview`, { credentials: "include" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "Admin access failed");
        return body as Overview;
      })
      .then(setOverview)
      .catch((reason: Error) => setError(reason.message));
  }, []);

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
