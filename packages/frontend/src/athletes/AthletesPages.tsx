import { useAthletesDetail } from "./useAthletesDetail";
import { sports, sportLabel } from "./sports";
import { AthletesCommunityForm } from "./AthletesCommunityForm";
import type { AthletesSport } from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicAthletesSummary } from "../api";
import { useHoomaFrontend } from "../context";
import { AthletesWhistleBoard } from "../whistle/HoomaWhistleBoard";
import { AthletesPhotoBoard } from "./AthletesPhotoBoard";
import { ActiveAthletesList } from "./ActiveAthletesList";

function report(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function locationLabel(item: Pick<PublicAthletesSummary, "city" | "houma" | "slug">): string {
  return [item.city, item.houma].filter(Boolean).join(" · ") || `@${item.slug}`;
}

export function AthletesPage({
  onCreateCommunity,
  createCommunityDisabled = false,
}: {
  readonly onCreateCommunity: () => void;
  readonly createCommunityDisabled?: boolean;
}) {
  const { api } = useHoomaFrontend();
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicAthletesSummary[]>([]);
  const [sport, setSport] = useState<AthletesSport | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const pagePending = useRef(false);
  const load = useCallback(
    async (cursor?: string) => {
      if (cursor && pagePending.current) return;
      const version = generation.current;
      pagePending.current = true;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const response = await api.athletes.publicList({
          limit: 30,
          ...(sport === "ALL" ? {} : { sport }),
          ...(cursor ? { cursor } : {}),
        });
        if (version !== generation.current) return;
        setItems((previous) =>
          cursor
            ? [
                ...previous,
                ...response.items.filter(
                  (item) => !previous.some((existing) => existing.id === item.id),
                ),
              ]
            : response.items,
        );
        setNextCursor(response.nextCursor);
      } catch (reason) {
        if (version === generation.current) setError(report(reason, "Unable to load Athletes"));
      } finally {
        if (version === generation.current) {
          pagePending.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [api, sport],
  );
  useEffect(() => {
    generation.current += 1;
    pagePending.current = false;
    setItems([]);
    setNextCursor(null);
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  return (
    <div className="page athletes-page">
      <section className="athletes-surface athletes-hero athletes-hero--hub">
        <div className="athletes-hero__content">
          <span className="eyebrow">ATHLETES</span>
          <h1>Move together. Train together.</h1>
          <p>Find local sports communities built around the way you move.</p>
          <div className="athletes-actions">
            <button
              className="button athletes-action athletes-action--primary"
              type="button"
              onClick={onCreateCommunity}
              disabled={createCommunityDisabled}
            >
              <span className="athletes-action__icon" aria-hidden="true">
                +
              </span>
              Create community
            </button>
          </div>
        </div>
        <span className="athletes-hero__motion" aria-hidden="true" />
      </section>

      <section className="athletes-surface athletes-filter" aria-label="Filter Athletes by sport">
        <div className="athletes-section-heading">
          <span className="eyebrow">SPORT</span>
          <span className="athletes-section-heading__hint">Find your pace</span>
        </div>
        <div className="athletes-sport-chips">
          <button
            className={sport === "ALL" ? "is-active" : ""}
            type="button"
            aria-pressed={sport === "ALL"}
            onClick={() => setSport("ALL")}
          >
            All
          </button>
          {sports.map((option) => (
            <button
              key={option.value}
              className={sport === option.value ? "is-active" : ""}
              type="button"
              aria-pressed={sport === option.value}
              onClick={() => setSport(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="error-box" role="alert">
          {error} <button onClick={() => void load(nextCursor ?? undefined)}>Retry</button>
        </div>
      ) : null}
      {loading ? <div className="state-card">Loading Athletes communities…</div> : null}
      {!loading && !items.length && !error ? (
        <div className="state-card">
          No Athletes communities yet. Start the first real training circle.
        </div>
      ) : null}
      {items.length ? (
        <section className="athletes-grid" aria-label="Athletes communities">
          {items.map((item) => (
            <button
              className="athletes-card"
              data-sport={item.sport}
              type="button"
              key={item.id}
              onClick={() => navigate(`/athletes/${item.id}`)}
            >
              <AthletesImage
                src={item.bannerUrl}
                className="athletes-banner"
                alt={`${item.name} banner`}
              />
              <AthletesImage
                src={item.logoUrl}
                className="athletes-logo"
                alt={`${item.name} logo`}
              />
              <span className="athletes-card__motif" aria-hidden="true" />
              <span className="athletes-sport">{sportLabel(item.sport)}</span>
              <h2>{item.name}</h2>
              <p>{item.description || "Train and compete with people nearby."}</p>
              <div className="athletes-card__footer">
                <small>{locationLabel(item)}</small>
                <span>
                  {item.visibility === "PRIVATE"
                    ? "Approval required"
                    : item.joinPolicy === "OPEN"
                      ? "Open to join"
                      : "Request to join"}{" "}
                  · {item.memberCount} members
                </span>
              </div>
            </button>
          ))}
        </section>
      ) : null}
      {nextCursor ? (
        <button
          className="button athletes-action athletes-action--secondary"
          disabled={loadingMore}
          onClick={() => void load(nextCursor)}
        >
          {loadingMore ? "Loading…" : "Load more communities"}
        </button>
      ) : null}
    </div>
  );
}

export function CreateAthletesPage() {
  const navigate = useNavigate();
  return (
    <AthletesCommunityForm
      onSaved={(id) => navigate(`/athletes/${id}`, { replace: true })}
      onCancel={() => navigate("/athletes")}
    />
  );
}

export function AthletesDetailPage({
  athletesCommunityId,
}: {
  readonly athletesCommunityId: string;
}) {
  return (
    <AthletesDetailContent key={athletesCommunityId} athletesCommunityId={athletesCommunityId} />
  );
}

function AthletesDetailContent({
  athletesCommunityId: id,
}: {
  readonly athletesCommunityId: string;
}) {
  const { api } = useHoomaFrontend();
  const navigate = useNavigate();
  const state = useAthletesDetail(id);
  const {
    detail,
    members,
    requests,
    error,
    membersError,
    requestsError,
    notice,
    loading,
    busy,
    reload,
    act,
  } = state;
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const founder = detail?.viewerRole === "FOUNDER";
  const canManage = founder || detail?.viewerRole === "MODERATOR";

  if (loading)
    return (
      <div className="page athletes-page">
        <div className="state-card" role="status">
          Loading Athletes community…
        </div>
      </div>
    );
  if (!detail)
    return (
      <div className="page athletes-page">
        <div className="error-box" role="alert">
          {error || "Community unavailable."}
        </div>
        <button className="button" onClick={() => void reload()}>
          Retry
        </button>
      </div>
    );
  if (editing && founder)
    return (
      <AthletesCommunityForm
        community={detail}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
        onCancel={() => setEditing(false)}
      />
    );

  return (
    <div className="page athletes-page athletes-detail-page" data-sport={detail.sport}>
      <button
        type="button"
        className="team-management-back athletes-back"
        onClick={() => navigate("/athletes")}
      >
        ← Athletes
      </button>
      <section
        className="athletes-surface athletes-hero athletes-hero--detail"
        data-sport={detail.sport}
      >
        <AthletesImage
          src={detail.bannerUrl}
          className="athletes-banner"
          alt={`${detail.name} banner`}
        />
        <div className="athletes-hero__content">
          <AthletesImage
            src={detail.logoUrl}
            className="athletes-logo"
            alt={`${detail.name} logo`}
          />
          <span className="eyebrow">{sportLabel(detail.sport)}</span>
          <h1>{detail.name}</h1>
          <p>{detail.description || "Train and compete with this Athletes community."}</p>
          <div className="athletes-hero__meta">
            <span>{locationLabel(detail)}</span>
            <span>{detail.memberCount} athletes</span>
          </div>
        </div>
      </section>
      {notice ? (
        <div className="success-box" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}
      <section className="athletes-surface athletes-join-panel">
        <div className="athletes-join-panel__status">
          <span>{detail.visibility === "PRIVATE" ? "Private" : "Public"}</span>
          <span>{detail.joinPolicy === "OPEN" ? "Open join" : "Approval required"}</span>
        </div>
        {detail.viewerRole ? (
          <strong className="athletes-role">{detail.viewerRole}</strong>
        ) : detail.viewerJoinRequestStatus === "PENDING" ? (
          <>
            <span role="status">Join request pending</span>
            <button
              type="button"
              className="button secondary athletes-action athletes-action--secondary"
              disabled={busy}
              onClick={() =>
                void act(() => api.athletes.cancelJoinRequest(id), "Join request cancelled.")
              }
            >
              Cancel request
            </button>
          </>
        ) : (
          <button
            className="button athletes-action athletes-action--primary"
            disabled={busy}
            onClick={() =>
              void act(
                () => api.athletes.join(id),
                detail.joinPolicy === "OPEN" ? "Joined Athletes community." : "Join request sent.",
              )
            }
          >
            {detail.joinPolicy === "OPEN" ? "Join" : "Request to join"}
          </button>
        )}
      </section>
      {founder ? (
        <section className="athletes-surface athletes-section">
          <h2>Community settings</h2>
          <div className="athletes-actions">
            <button
              className="button athletes-action athletes-action--secondary"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              Edit community
            </button>
            <button
              className="athletes-mini-action athletes-mini-action--decline"
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
            >
              Archive community
            </button>
          </div>
          {confirmArchive ? (
            <div role="group" aria-label="Confirm archive">
              <p>Archive {detail.name}? Member access will close. Photos will be retained.</p>
              <button
                className="athletes-mini-action athletes-mini-action--decline"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => api.athletes.archive(id),
                    "Community archived.",
                    () => navigate("/athletes", { replace: true }),
                  )
                }
              >
                Confirm archive
              </button>{" "}
              <button
                className="athletes-mini-action"
                disabled={busy}
                onClick={() => setConfirmArchive(false)}
              >
                Keep community
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {detail.viewerRole ? (
        <>
          <AthletesWhistleBoard athletesCommunityId={id} />
          <AthletesPhotoBoard
            athletesCommunityId={id}
            communityStatus={detail.status}
            viewerRole={detail.viewerRole}
          />
          <section className="athletes-surface athletes-section">
            <h2>Active Athletes</h2>
            {membersError ? (
              <div role="alert" className="error-box">
                {membersError} <button onClick={() => void reload()}>Retry members</button>
              </div>
            ) : (
              <ActiveAthletesList
                members={members}
                founder={founder}
                canManage={canManage}
                busy={busy}
                onToggleRole={(member) =>
                  void act(
                    () =>
                      api.athletes.setMemberRole(
                        id,
                        member.userId,
                        member.role === "MODERATOR" ? "MEMBER" : "MODERATOR",
                      ),
                    "Member role updated.",
                  )
                }
                onRemove={(member) =>
                  void act(() => api.athletes.removeMember(id, member.userId), "Member removed.")
                }
              />
            )}
          </section>
        </>
      ) : null}
      {canManage ? (
        <section className="athletes-surface athletes-section athletes-manage-section">
          <h2>Manage members</h2>
          <form
            className="athletes-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await api.athletes.addMember(id, username);
                setUsername("");
              }, "Member added.");
            }}
          >
            <input
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              placeholder="username"
              aria-label="Username to add"
              required
              maxLength={50}
              disabled={busy}
            />
            <button
              className="button athletes-action athletes-action--secondary"
              type="submit"
              disabled={busy}
            >
              Add member
            </button>
          </form>
          <h3>Join requests</h3>
          {requestsError ? (
            <div className="error-box" role="alert">
              {requestsError} <button onClick={() => void reload()}>Retry requests</button>
            </div>
          ) : requests.length ? (
            <div className="athletes-member-list athletes-request-list">
              {requests.map((request) => (
                <div className="athletes-member-row athletes-request-row" key={request.id}>
                  <span>
                    {request.requester.presentation?.displayName ?? "Member"}
                    {request.requester.presentation ? (
                      <small>@{request.requester.presentation.username}</small>
                    ) : null}
                  </span>
                  <span className="athletes-request-actions">
                    <button
                      className="athletes-mini-action athletes-mini-action--approve"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => api.athletes.approveJoinRequest(id, request.userId),
                          "Join request approved.",
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="athletes-mini-action athletes-mini-action--decline"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => api.athletes.declineJoinRequest(id, request.userId),
                          "Join request declined.",
                        )
                      }
                    >
                      Decline
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No pending join requests.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function AthletesImage({
  src,
  alt,
  className,
}: {
  readonly src: string | null;
  readonly alt: string;
  readonly className: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return src && failedSrc !== src ? (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  ) : null;
}
