import type { PlatformAuditEntry } from "@hooma/frontend";

type AuditLoadState = "loading" | "ready" | "error";

export function AuditArchive({
  entries,
  loadState,
}: {
  readonly entries: readonly PlatformAuditEntry[];
  readonly loadState: AuditLoadState;
}) {
  return (
    <section className="panel admin-audit-section" id="audit-archive">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EVIDENCE</p>
          <h2>Audit Archive</h2>
        </div>
        <span>{loadState === "ready" ? entries.length : "—"}</span>
      </div>
      {loadState === "loading" ? <p className="muted">Loading audit archive…</p> : null}
      {loadState === "error" ? <p className="muted">Audit archive is unavailable.</p> : null}
      {loadState === "ready" && !entries.length ? (
        <p className="muted">No audit entries are available.</p>
      ) : null}
      {loadState === "ready" && entries.length ? (
        <div className="admin-audit-list">
          {entries.map((entry) => (
            <article key={entry.id}>
              <strong>{entry.action}</strong>
              <span>
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""}
              </span>
              <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
