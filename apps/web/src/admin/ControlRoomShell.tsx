import type { ReactNode } from "react";
import type { PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import { AdminIcon, type AdminIconName } from "./AdminIcons";

function capabilityLabel(capability: PlatformManagerCapability): string {
  if (capability === "REVIEW_PITCH_APPLICATIONS") return "Pitch Review";
  if (capability === "MANAGE_ADMIN_ISSUES") return "Admin Issues";
  if (capability === "MANAGE_USERS") return "User Security";
  return "Audit";
}

type NavigationLink =
  | {
      readonly href: string;
      readonly label: string;
      readonly icon: AdminIconName;
      readonly status?: never;
    }
  | {
      readonly label: string;
      readonly icon: AdminIconName;
      readonly status: "coming-soon";
      readonly href?: never;
    };

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
  const groups: readonly NavigationLink[] = [
    { href: "#control-room-overview", label: "Overview", icon: "dashboard" },
    ...(canManageAdminIssues
      ? [{ href: "#admin-action-inbox", label: "Action Inbox", icon: "warning" as const }]
      : []),
    ...(canManageUsers
      ? [{ href: "#user-security", label: "People", icon: "people" as const }]
      : []),
    ...(canManageUsers || isPlatformOwner
      ? [
          {
            href: canManageUsers ? "#user-security" : "#gamers",
            label: "Moderation",
            icon: "moderation" as const,
          },
        ]
      : []),
    ...(isPlatformOwner
      ? [{ href: "#communities", label: "Communities", icon: "communities" as const }]
      : []),
    ...(isPlatformOwner ? [{ href: "#teams", label: "Teams", icon: "teams" as const }] : []),
    ...(isPlatformOwner ? [{ href: "#gamers", label: "Players", icon: "gamepad" as const }] : []),
    ...(isPlatformOwner
      ? [{ label: "Rides", status: "coming-soon" as const, icon: "car" as const }]
      : []),
    ...(isPlatformOwner || canReviewPitch
      ? [
          {
            href: isPlatformOwner ? "#places" : "#pitch",
            label: "Operations",
            icon: "operations" as const,
          },
        ]
      : []),
    ...(isPlatformOwner
      ? [{ href: "#access-managers", label: "Access", icon: "access" as const }]
      : []),
    ...(canViewAudit
      ? [{ href: "#audit-archive", label: "Audit Archive", icon: "archive" as const }]
      : []),
  ];

  return (
    <nav className="admin-navigation" aria-label="Platform Control Room sections">
      {groups.map((link) =>
        "href" in link ? (
          <a
            aria-label={link.label === "People" ? "User Controls" : undefined}
            className="admin-nav-item"
            href={link.href}
            key={`${link.href}:${link.label}`}
          >
            <AdminIcon name={link.icon} />
            <span>{link.label}</span>
          </a>
        ) : (
          <span
            className="admin-nav-item admin-navigation-disabled"
            aria-disabled="true"
            key={link.label}
          >
            <AdminIcon name={link.icon} />
            <span>{link.label}</span>
            <small aria-disabled="true">Coming soon</small>
          </span>
        ),
      )}
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
    <section className="admin-control-room admin-workbench">
      <header className="admin-hero admin-panel admin-workbench-header">
        <div>
          <p className="eyebrow">{isPlatformOwner ? "PLATFORM ADMIN" : "APP MANAGER"}</p>
          <h1>Platform Control Room</h1>
          <p className="muted">
            {isPlatformOwner
              ? "Operator console for live platform queues, user safety, access, and audit evidence."
              : "Delegated platform authority is limited to the permissions assigned by a Platform Admin."}
          </p>
        </div>
        <div className="admin-command-bar" aria-label="Current authority">
          <span className="admin-chip admin-chip-success">
            <AdminIcon name="check" />
            {isPlatformOwner ? "Owner authority" : delegatedAuthority || "No delegated permissions"}
          </span>
          {message ? <span className="admin-chip admin-chip-success">{message}</span> : null}
          {error ? <span className="admin-chip admin-chip-danger">{error}</span> : null}
        </div>
      </header>

      <ControlRoomNavigation
        isPlatformOwner={isPlatformOwner}
        canReviewPitch={canReviewPitch}
        canViewAudit={canViewAudit}
        canManageAdminIssues={canManageAdminIssues}
        canManageUsers={canManageUsers}
      />

      <div className="admin-workspace">{children}</div>
    </section>
  );
}
