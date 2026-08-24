import { useEffect, useState } from "react";
import { useHoomaFrontend, type PlatformAdminOverview } from "@hooma/frontend";

export function AdminApp() {
  const { api } = useHoomaFrontend();
  const [overview, setOverview] = useState<PlatformAdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.platformAdmin
      .overview()
      .then(setOverview)
      .catch((reason: Error) => setError(reason.message));
  }, [api]);

  return (
    <section className="auth-card">
      <p className="eyebrow">APP ADMIN</p>
      <h2>HOOMA Control Room</h2>
      {overview ? (
        <dl>
          <div>
            <dt>Users</dt>
            <dd>{overview.users}</dd>
          </div>
          <div>
            <dt>Platform Admins</dt>
            <dd>{overview.activePlatformAdmins}</dd>
          </div>
          <div>
            <dt>Audit entries</dt>
            <dd>{overview.auditEntries}</dd>
          </div>
        </dl>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
