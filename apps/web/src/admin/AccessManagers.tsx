import type { FormEvent } from "react";
import type { AppManagerSummary, PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import { AdminIcon, type AdminIconName } from "./AdminIcons";

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
  icon: AdminIconName;
} {
  if (capability === "REVIEW_PITCH_APPLICATIONS") {
    return {
      label: "Pitch Review",
      description: "Review existing Pitch applications and revisions.",
      icon: "operations",
    };
  }
  if (capability === "MANAGE_ADMIN_ISSUES") {
    return {
      label: "Admin Issues",
      description: "Resolve and dismiss existing operational admin issues.",
      icon: "warning",
    };
  }
  if (capability === "MANAGE_USERS") {
    return {
      label: "User Security",
      description: "Search safe user identity details and revoke active web sessions.",
      icon: "moderation",
    };
  }
  return {
    label: "Audit",
    description: "View the platform audit archive and overview totals.",
    icon: "archive",
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
    <section className="admin-panel admin-manager-section" id="access-managers">
      <div className="section-heading admin-toolbar">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h2>Access Managers</h2>
        </div>
        <span className="admin-chip">
          <AdminIcon name="key" />
          {loadState === "ready" ? `${managers.length} managers` : "—"}
        </span>
      </div>
      <form
        className="admin-manager-console"
        aria-busy={isSaving}
        onSubmit={(event) => void onSubmit(event)}
      >
        <div className="admin-command-bar admin-manager-lookup">
          <label>
            <span>Manager username</span>
            <input name="username" placeholder="HOOMA username" required disabled={isSaving} />
          </label>
          <button className="admin-primary-action" type="submit" disabled={isSaving}>
            <AdminIcon name="check" />
            {isSaving ? "Saving…" : "Save App Manager permissions"}
          </button>
        </div>
        <div className="admin-capability-grid" role="group" aria-label="App Manager capabilities">
          {MANAGER_CAPABILITIES.map((capability) => {
            const copy = capabilityCopy(capability);
            return (
              <label className="admin-capability-row" key={capability}>
                <input type="checkbox" name={capability} disabled={isSaving} />
                <span className="admin-capability-icon" aria-hidden="true">
                  <AdminIcon name={copy.icon} />
                </span>
                <span>
                  <strong>{copy.label}</strong>
                  <small>{copy.description}</small>
                </span>
              </label>
            );
          })}
        </div>
        <p className="muted admin-empty-state">
          Submit with no permissions selected to revoke all App Manager access. Platform Admin-only
          domains remain locked to owner authority.
        </p>
      </form>
      <div className="admin-manager-list admin-row-list">
        {loadState === "loading" ? (
          <p className="muted admin-empty-state">Loading App Managers…</p>
        ) : null}
        {loadState === "error" ? (
          <p className="muted admin-empty-state">App Managers are unavailable.</p>
        ) : null}
        {loadState === "ready" && !managers.length ? (
          <p className="muted admin-empty-state">No App Managers have delegated permissions.</p>
        ) : null}
        {loadState === "ready"
          ? managers.map((manager) => (
              <article className="admin-data-row" key={manager.userId}>
                <div>
                  <strong>{manager.displayName}</strong>
                  <span>@{manager.username}</span>
                </div>
                <div className="admin-chip-row">
                  {manager.capabilities.length ? (
                    manager.capabilities.map((capability) => (
                      <span className="admin-chip" key={`${manager.userId}:${capability}`}>
                        {capabilityCopy(capability).label}
                      </span>
                    ))
                  ) : (
                    <span className="admin-chip admin-chip-muted">
                      No active delegated permissions
                    </span>
                  )}
                </div>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}
