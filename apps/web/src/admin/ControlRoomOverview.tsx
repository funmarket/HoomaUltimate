import type { PlatformAuditEntry, PlatformOverview } from "@hooma/frontend";

export type AttentionLoadState = "loading" | "ready" | "error";

export interface AttentionItem {
  readonly label: string;
  readonly count: number | null;
  readonly href: string;
  readonly state: AttentionLoadState;
}

function attentionStateLabel(item: AttentionItem): string {
  if (item.state === "loading") return "Loading";
  if (item.state === "error") return "Unavailable";
  return item.count === 0 ? "Clear" : "Open";
}

export function ControlRoomOverview({
  overview,
  overviewState,
  attentionItems,
  recentAudit,
  auditState,
}: {
  readonly overview: PlatformOverview | null;
  readonly overviewState: AttentionLoadState | null;
  readonly attentionItems: readonly AttentionItem[];
  readonly recentAudit: readonly PlatformAuditEntry[];
  readonly auditState: AttentionLoadState | null;
}) {
  return (
    <section className="admin-overview" id="control-room-overview">
      <section className="panel" id="needs-attention">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OVERVIEW</p>
            <h2>Needs Attention</h2>
          </div>
        </div>
        {attentionItems.length ? (
          <div className="admin-attention-grid">
            {attentionItems.map((item) => (
              <a className="admin-attention-card" href={item.href} key={item.href}>
                <span>{item.label}</span>
                <strong>{item.state === "ready" && item.count !== null ? item.count : "—"}</strong>
                <small>{attentionStateLabel(item)}</small>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">No review queues are delegated to this App Manager.</p>
        )}
      </section>

      {overviewState ? (
        <section className="panel admin-snapshot">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PLATFORM SNAPSHOT</p>
              <h2>Current platform totals</h2>
            </div>
          </div>
          {overviewState === "loading" ? <p className="muted">Loading platform totals…</p> : null}
          {overviewState === "error" ? (
            <p className="muted">Platform totals are unavailable.</p>
          ) : null}
          {overviewState === "ready" && !overview ? (
            <p className="muted">No platform totals are available.</p>
          ) : null}
          {overviewState === "ready" && overview ? (
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
                <dt>App Managers</dt>
                <dd>{overview.activeAppManagers}</dd>
              </div>
              <div>
                <dt>Audit entries</dt>
                <dd>{overview.auditEntries}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      {auditState ? (
        <section className="panel admin-recent-activity">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RECENT ADMIN ACTIVITY</p>
              <h2>Latest audit evidence</h2>
            </div>
            <a className="admin-link" href="#audit-archive">
              View Audit Archive
            </a>
          </div>
          {auditState === "loading" ? <p className="muted">Loading recent activity…</p> : null}
          {auditState === "error" ? <p className="muted">Recent activity is unavailable.</p> : null}
          {auditState === "ready" && !recentAudit.length ? (
            <p className="muted">No audit entries are available.</p>
          ) : null}
          {auditState === "ready" && recentAudit.length ? (
            <div className="admin-audit-list">
              {recentAudit.map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.action}</strong>
                  <span>
                    {entry.entityType}
                    {entry.entityId ? ` · ${entry.entityId}` : ""}
                  </span>
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
