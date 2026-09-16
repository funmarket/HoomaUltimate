import type { FormEvent } from "react";
import type { AppManagerSummary, PlatformManagerCapability } from "@hooma/contracts/platform-admin";

export const MANAGER_CAPABILITIES: readonly PlatformManagerCapability[] = [
  "REVIEW_PITCH_APPLICATIONS",
  "VIEW_AUDIT",
  "MANAGE_ADMIN_ISSUES",
  "MANAGE_USERS",
];

type ManagerLoadState = "loading" | "ready" | "error";

function capabilityCopy(capability: PlatformManagerCapability): {
  label: string;
  description: string;
} {
  if (capability === "REVIEW_PITCH_APPLICATIONS") {
    return {
      label: "Pitch Review",
      description: "Review existing Pitch applications and revisions.",
    };
  }
  if (capability === "MANAGE_ADMIN_ISSUES") {
    return {
      label: "Admin Issues",
      description: "Resolve and dismiss existing operational admin issues.",
    };
  }
  if (capability === "MANAGE_USERS") {
    return {
      label: "User Security",
      description: "Search safe user identity details and revoke active web sessions.",
    };
  }
  return {
    label: "Audit",
    description: "View the existing platform audit archive and overview totals.",
  };
}

export function AccessManagers({
  managers,
  loadState,
  isSaving,
  onSubmit,
}: {
  readonly managers: readonly AppManagerSummary[];
  readonly loadState: ManagerLoadState;
  readonly isSaving: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="panel admin-manager-section" id="access-managers">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PEOPLE</p>
          <h2>Access &amp; Managers</h2>
        </div>
        <span>{loadState === "ready" ? managers.length : "—"}</span>
      </div>
      <form
        className="admin-manager-form"
        aria-busy={isSaving}
        onSubmit={(event) => void onSubmit(event)}
      >
        <input name="username" placeholder="HOOMA username" required disabled={isSaving} />
        <div className="admin-capability-grid">
          {MANAGER_CAPABILITIES.map((capability) => {
            const copy = capabilityCopy(capability);
            return (
              <label key={capability}>
                <input type="checkbox" name={capability} disabled={isSaving} />
                <span>
                  <strong>{copy.label}</strong>
                  <small>{copy.description}</small>
                </span>
              </label>
            );
          })}
        </div>
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving App Manager permissions…" : "Save App Manager permissions"}
        </button>
        <p className="muted">
          Place submissions, ownership claims, Gamer disputes, Communities and Teams remain Platform
          Admin-only. Submit with no permissions selected to revoke all App Manager access.
        </p>
      </form>
      <div className="admin-manager-list">
        {loadState === "loading" ? <p className="muted">Loading App Managers…</p> : null}
        {loadState === "error" ? <p className="muted">App Managers are unavailable.</p> : null}
        {loadState === "ready" && !managers.length ? (
          <p className="muted">No App Managers have delegated permissions.</p>
        ) : null}
        {loadState === "ready"
          ? managers.map((manager) => (
              <article key={manager.userId}>
                <strong>{manager.displayName}</strong>
                <span>@{manager.username}</span>
                <small>
                  {manager.capabilities.length
                    ? manager.capabilities
                        .map((capability) => capabilityCopy(capability).label)
                        .join(" · ")
                    : "No active delegated permissions"}
                </small>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}
