import type { ReactNode } from "react";
import type { PlatformManagerCapability } from "@hooma/contracts/platform-admin";

function capabilityLabel(capability: PlatformManagerCapability): string {
  if (capability === "REVIEW_PITCH_APPLICATIONS") return "Pitch Review";
  if (capability === "MANAGE_ADMIN_ISSUES") return "Admin Issues";
  if (capability === "MANAGE_USERS") return "User Security";
  return "Audit";
}

function ControlRoomNavigation({
  isPlatformOwner,
  canReviewPitch,
  canViewAudit,
  canManageAdminIssues,
  canManageUsers,
}: {
  readonly isPlatformOwner: boolean;
  readonly canReviewPitch: boolean;
  readonly canViewAudit: boolean;
  readonly canManageAdminIssues: boolean;
  readonly canManageUsers: boolean;
}) {
  const groups = [
    {
      label: "OVERVIEW",
      links: [
        { href: "#control-room-overview", label: "Dashboard" },
        { href: "#needs-attention", label: "Needs Attention" },
      ],
    },
    {
      label: "PEOPLE",
      links: [
        ...(canManageUsers ? [{ href: "#user-security", label: "User Security" }] : []),
        ...(isPlatformOwner ? [{ href: "#access-managers", label: "Access & Managers" }] : []),
      ],
    },
    {
      label: "CONTENT & COMMUNITIES",
      links: isPlatformOwner
        ? [
            { href: "#communities", label: "HOOMA Communities" },
            { href: "#teams", label: "Teams" },
          ]
        : [],
    },
    {
      label: "PLACES & ACTIVITY",
      links: [
        ...(isPlatformOwner
          ? [
              { href: "#places", label: "Places" },
              { href: "#place-ownership", label: "Place Ownership" },
            ]
          : []),
        ...(canReviewPitch ? [{ href: "#pitch", label: "Pitch" }] : []),
        ...(isPlatformOwner ? [{ href: "#gamers", label: "Gamers" }] : []),
      ],
    },
    {
      label: "AUDIT & ISSUES",
      links: [
        ...(canManageAdminIssues ? [{ href: "#admin-action-inbox", label: "Admin Issues" }] : []),
        ...(canViewAudit ? [{ href: "#audit-archive", label: "Audit Archive" }] : []),
      ],
    },
  ].filter((group) => group.links.length > 0);

  return (
    <nav className="admin-navigation" aria-label="Platform Control Room">
      {groups.map((group) => (
        <div className="admin-navigation-group" key={group.label}>
          <span>{group.label}</span>
          <div>
            {group.links.map((link) => (
              <a href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function ControlRoomShell({
  isPlatformOwner,
  managerCapabilities,
  canReviewPitch,
  canViewAudit,
  canManageAdminIssues,
  canManageUsers,
  message,
  error,
  children,
}: {
  readonly isPlatformOwner: boolean;
  readonly managerCapabilities: readonly PlatformManagerCapability[];
  readonly canReviewPitch: boolean;
  readonly canViewAudit: boolean;
  readonly canManageAdminIssues: boolean;
  readonly canManageUsers: boolean;
  readonly message: string;
  readonly error: string;
  readonly children: ReactNode;
}) {
  const delegatedAuthority = managerCapabilities.map(capabilityLabel).join(" · ");

  return (
    <section className="admin-control-room">
      <section className="auth-card admin-hero">
        <p className="eyebrow">{isPlatformOwner ? "PLATFORM ADMIN" : "APP MANAGER"}</p>
        <h1>Platform Control Room</h1>
        <p className="muted">
          {isPlatformOwner
            ? "Global platform administration authority. Domain rules remain enforced by their owning services."
            : "Delegated platform authority is limited to the permissions assigned by a Platform Admin."}
        </p>
        {!isPlatformOwner ? (
          <p className="admin-authority-detail">
            {delegatedAuthority || "No delegated permissions"}
          </p>
        ) : null}
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <ControlRoomNavigation
        isPlatformOwner={isPlatformOwner}
        canReviewPitch={canReviewPitch}
        canViewAudit={canViewAudit}
        canManageAdminIssues={canManageAdminIssues}
        canManageUsers={canManageUsers}
      />

      {children}
    </section>
  );
}
