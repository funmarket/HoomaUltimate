import type { AthletesMember } from "@hooma/contracts/athletes";

function lastSeenLabel(value: string | null): string {
  if (!value) return "No recent web activity";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "No recent web activity";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "Last seen just now";
  if (elapsed < 60 * 60_000) return `Last seen ${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000)
    return `Last seen ${Math.floor(elapsed / (60 * 60_000))}h ago`;
  return `Last seen ${Math.floor(elapsed / (24 * 60 * 60_000))}d ago`;
}

export function ActiveAthletesList({
  members,
  founder,
  canManage,
  busy,
  onToggleRole,
  onRemove,
}: {
  readonly members: readonly AthletesMember[];
  readonly founder: boolean;
  readonly canManage: boolean;
  readonly busy: boolean;
  readonly onToggleRole: (member: AthletesMember) => void;
  readonly onRemove: (member: AthletesMember) => void;
}) {
  return (
    <div className="active-athletes-list">
      {members.map((member) => {
        const presentation = member.presentation;
        return (
          <div className="active-athlete-row" key={member.userId}>
            <div className="active-athlete-identity">
              <span className="active-athlete-avatar" aria-hidden="true">
                {presentation?.photoUrl ? (
                  <img src={presentation.photoUrl} alt="" loading="lazy" />
                ) : (
                  <span>{presentation?.displayName?.trim().charAt(0).toUpperCase() || "A"}</span>
                )}
              </span>
              <div className="active-athlete-copy">
                {presentation ? (
                  <a
                    className="active-athlete-profile"
                    href={`/profile/${encodeURIComponent(presentation.username)}`}
                  >
                    <strong>{presentation.displayName}</strong>
                    <span>@{presentation.username}</span>
                  </a>
                ) : (
                  <strong>Member</strong>
                )}
                <small className="active-athlete-last-seen">
                  {lastSeenLabel(member.lastSeenAt)}
                </small>
              </div>
            </div>
            <div className="active-athlete-meta">
              <span className="active-athlete-role">{member.role}</span>
              {canManage && member.role !== "FOUNDER" ? (
                <span className="athletes-request-actions">
                  {founder ? (
                    <button
                      className="athletes-mini-action"
                      disabled={busy}
                      onClick={() => onToggleRole(member)}
                    >
                      {member.role === "MODERATOR" ? "Remove moderator role" : "Make moderator"}
                    </button>
                  ) : null}
                  {founder || member.role === "MEMBER" ? (
                    <button
                      className="athletes-mini-action athletes-mini-action--decline"
                      disabled={busy}
                      onClick={() => onRemove(member)}
                    >
                      Remove member
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
