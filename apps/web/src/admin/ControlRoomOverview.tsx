import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createPlatformAdminApi,
  useHoomaFrontend,
  type AdminIssueSummary,
  type PlatformAuditEntry,
  type PlatformOverview,
} from "@hooma/frontend";

export type AttentionLoadState = "loading" | "ready" | "error";

export interface AttentionItem {
  readonly label: string;
  readonly count: number | null;
  readonly href: string;
  readonly state: AttentionLoadState;
}

type IssueDisposition = "resolve" | "dismiss";

const EMPTY_ADMIN_ISSUES: readonly AdminIssueSummary[] = [];

function attentionStateLabel(item: AttentionItem): string {
  if (item.state === "loading") return "Loading";
  if (item.state === "error") return "Unavailable";
  return item.count === 0 ? "Clear" : "Open";
}

function AdminIssueDispositionControls({
  issue,
  onCompleted,
}: {
  readonly issue: AdminIssueSummary;
  readonly onCompleted: (issues: readonly AdminIssueSummary[], message: string) => void;
}) {
  const { transport } = useHoomaFrontend();
  const adminApi = useMemo(() => createPlatformAdminApi(transport), [transport]);
  const [disposition, setDisposition] = useState<IssueDisposition | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const actionInFlight = useRef(false);

  function begin(nextDisposition: IssueDisposition) {
    if (actionInFlight.current) return;
    setDisposition(nextDisposition);
    setNote("");
    setError("");
  }

  function cancel() {
    if (actionInFlight.current) return;
    setDisposition(null);
    setNote("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disposition || actionInFlight.current) return;
    const reason = note.trim();
    if (!reason) {
      setError("A reason is required.");
      return;
    }

    actionInFlight.current = true;
    setPending(true);
    setError("");
    try {
      if (disposition === "resolve") {
        await adminApi.resolveIssue(issue.id, { note: reason });
      } else {
        await adminApi.dismissIssue(issue.id, { note: reason });
      }
      const refreshedIssues = await adminApi.issues();
      onCompleted(
        refreshedIssues,
        `Admin issue ${disposition === "resolve" ? "resolved" : "dismissed"} and audited.`,
      );
      setDisposition(null);
      setNote("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update admin issue");
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      {disposition ? (
        <form className="admin-manager-form" noValidate onSubmit={(event) => void submit(event)}>
          <label>
            <span>Reason for {disposition === "resolve" ? "resolving" : "dismissing"} issue</span>
            <textarea
              aria-label={`Reason for ${
                disposition === "resolve" ? "resolving" : "dismissing"
              } issue`}
              value={note}
              maxLength={1000}
              rows={3}
              required
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : `Confirm ${disposition === "resolve" ? "resolve" : "dismiss"}`}
          </button>
          <button type="button" disabled={pending} onClick={cancel}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="admin-manager-form">
          <button type="button" disabled={pending} onClick={() => begin("resolve")}>
            Resolve
          </button>
          <button type="button" disabled={pending} onClick={() => begin("dismiss")}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export function ControlRoomOverview({
  overview,
  overviewState,
  attentionItems,
  adminIssues = EMPTY_ADMIN_ISSUES,
  adminIssuesState = null,
  recentAudit,
  auditState,
}: {
  readonly overview: PlatformOverview | null;
  readonly overviewState: AttentionLoadState | null;
  readonly attentionItems: readonly AttentionItem[];
  readonly adminIssues?: readonly AdminIssueSummary[];
  readonly adminIssuesState?: AttentionLoadState | null;
  readonly recentAudit: readonly PlatformAuditEntry[];
  readonly auditState: AttentionLoadState | null;
}) {
  const [visibleAdminIssues, setVisibleAdminIssues] =
    useState<readonly AdminIssueSummary[]>(adminIssues);
  const [issueMessage, setIssueMessage] = useState("");

  useEffect(() => {
    setVisibleAdminIssues(adminIssues);
  }, [adminIssues]);

  const canManageAdminIssues = attentionItems.some((item) => item.href === "#admin-action-inbox");
  const visibleAttentionItems = attentionItems.map((item) =>
    item.href === "#admin-action-inbox" && item.state === "ready"
      ? { ...item, count: visibleAdminIssues.length }
      : item,
  );

  return (
    <section className="admin-overview" id="control-room-overview">
      <section className="panel" id="needs-attention">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OVERVIEW</p>
            <h2>Needs Attention</h2>
          </div>
        </div>
        {visibleAttentionItems.length ? (
          <div className="admin-attention-grid">
            {visibleAttentionItems.map((item) => (
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

      {adminIssuesState ? (
        <section className="panel admin-action-inbox" id="admin-action-inbox">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OPERATIONAL ISSUES</p>
              <h2>Admin Action Inbox</h2>
            </div>
          </div>
          {issueMessage ? <p className="status">{issueMessage}</p> : null}
          {adminIssuesState === "loading" ? <p className="muted">Loading admin issues…</p> : null}
          {adminIssuesState === "error" ? (
            <p className="muted">Admin issues are unavailable.</p>
          ) : null}
          {adminIssuesState === "ready" && !visibleAdminIssues.length ? (
            <p className="muted">No operational admin issues require attention.</p>
          ) : null}
          {adminIssuesState === "ready" && visibleAdminIssues.length ? (
            <div className="admin-audit-list">
              {visibleAdminIssues.map((issue) => (
                <article key={issue.id}>
                  <strong>{issue.title}</strong>
                  <span>
                    {issue.summary} ·{" "}
                    {`${issue.occurrenceCount} ${
                      issue.occurrenceCount === 1 ? "occurrence" : "occurrences"
                    }`}
                  </span>
                  <time dateTime={issue.updatedAt}>
                    {new Date(issue.updatedAt).toLocaleString()}
                  </time>
                  {canManageAdminIssues ? (
                    <AdminIssueDispositionControls
                      issue={issue}
                      onCompleted={(issues, message) => {
                        setVisibleAdminIssues(issues);
                        setIssueMessage(message);
                      }}
                    />
                  ) : null}
                </article>
              ))}
            </div>
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
