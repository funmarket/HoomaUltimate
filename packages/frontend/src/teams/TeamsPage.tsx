import { useEffect, useMemo, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { TeamDiscoveryCard, TeamsHero } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import type { ManagedTeam, PublicTeamSummary, TeamChallengeSummary, TeamGameSummary } from "../api";

type TeamsTab = "discover" | "mine" | "requests" | "games";

function friendlyDate(value: string | null): string {
  if (!value) return "Scheduling TBA";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Scheduling TBA"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function report(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Teams error";
}

export function TeamsPage() {
  const { api, authenticationHref } = useHoomaFrontend();
  const [tab, setTab] = useState<TeamsTab>("discover");
  const [teams, setTeams] = useState<PublicTeamSummary[]>([]);
  const [myTeams, setMyTeams] = useState<PublicTeamSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [incoming, setIncoming] = useState<TeamChallengeSummary[]>([]);
  const [outgoing, setOutgoing] = useState<TeamChallengeSummary[]>([]);
  const [games, setGames] = useState<TeamGameSummary[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");
  const [loading, setLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);
  const [actingChallengeId, setActingChallengeId] = useState("");
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const managedIds = useMemo(() => new Set(managedTeams.map((team) => team.id)), [managedTeams]);
  const challenges = useMemo(() => {
    const byId = new Map<string, TeamChallengeSummary>();
    for (const challenge of [...incoming, ...outgoing]) byId.set(challenge.id, challenge);
    return [...byId.values()];
  }, [incoming, outgoing]);
  const pendingIncomingCount = useMemo(
    () => incoming.filter((challenge) => challenge.status === "PENDING").length,
    [incoming],
  );

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((response) => {
        if (active) setMe(response);
      })
      .catch((reason) => {
        if (active) setMemberError(report(reason));
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.teams
      .publicList({ search, city, houma, limit: 30 })
      .then((response) => {
        if (!active) return;
        setTeams(response.items);
        setNextCursor(response.nextCursor);
      })
      .catch((reason) => {
        if (active) setError(report(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, search, city, houma]);

  useEffect(() => {
    if (!me) {
      setMyTeams([]);
      setManagedTeams([]);
      setIncoming([]);
      setOutgoing([]);
      setGames([]);
      return;
    }
    void reloadMemberState();
  }, [me]);

  async function reloadMemberState() {
    setMemberLoading(true);
    setMemberError("");
    try {
      const [mine, managed, incomingRows, outgoingRows, gameRows] = await Promise.all([
        api.teams.mine(),
        api.teams.managed(),
        api.teams.incomingChallenges(),
        api.teams.outgoingChallenges(),
        api.teams.games(),
      ]);
      setMyTeams(mine);
      setManagedTeams(managed);
      setIncoming(incomingRows);
      setOutgoing(outgoingRows);
      setGames(gameRows);
    } catch (reason) {
      setMemberError(report(reason));
    } finally {
      setMemberLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.teams.publicList({
        search,
        city,
        houma,
        cursor: nextCursor,
        limit: 30,
      });
      setTeams((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (reason) {
      setError(report(reason));
    } finally {
      setLoading(false);
    }
  }

  async function respondToChallenge(id: string, action: "accept" | "decline" | "cancel") {
    setActingChallengeId(id);
    setMemberError("");
    setNotice("");
    try {
      if (action === "accept") await api.teams.acceptChallenge(id);
      else if (action === "decline") await api.teams.declineChallenge(id);
      else await api.teams.cancelChallenge(id);
      setNotice(
        `Challenge ${action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled"}.`,
      );
      await reloadMemberState();
    } catch (reason) {
      setMemberError(report(reason));
    } finally {
      setActingChallengeId("");
    }
  }

  const signInHref = authenticationHref("/teams");
  const memberGate = (
    <div className="member-gate">
      <strong>Sign in to use this Team section.</strong>
      <span className="muted">Discover stays public. Member sections require authentication.</span>
      {signInHref ? (
        <a className="button secondary" href={signInHref}>
          Sign in
        </a>
      ) : (
        <span className="muted">Open HOOMA through Telegram to authenticate.</span>
      )}
    </div>
  );

  return (
    <div className="page teams-page">
      <TeamsHero />
      <nav className="teams-tabs" aria-label="Teams sections">
        <button
          className={tab === "discover" ? "teams-tab active" : "teams-tab"}
          type="button"
          onClick={() => setTab("discover")}
        >
          Discover
        </button>
        <button
          className={tab === "mine" ? "teams-tab active" : "teams-tab"}
          type="button"
          onClick={() => setTab("mine")}
        >
          My Teams
        </button>
        <button
          className={tab === "requests" ? "teams-tab active" : "teams-tab"}
          type="button"
          onClick={() => setTab("requests")}
        >
          Requests {pendingIncomingCount ? <b>{pendingIncomingCount}</b> : null}
        </button>
        <button
          className={tab === "games" ? "teams-tab active" : "teams-tab"}
          type="button"
          onClick={() => setTab("games")}
        >
          Games
        </button>
      </nav>

      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {tab === "discover" ? (
        <>
          <section className="teams-filter-bar panel">
            <label className="field">
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Team, city or houma"
              />
            </label>
            <label className="field">
              <span>City</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Any city"
              />
            </label>
            <label className="field">
              <span>Houma</span>
              <input
                value={houma}
                onChange={(event) => setHouma(event.target.value)}
                placeholder="Any houma"
              />
            </label>
          </section>

          <div className="teams-section-heading">
            <div>
              <span className="eyebrow">BUILD YOUR SIDE</span>
              <p className="muted">Team creation now has its own page.</p>
            </div>
            <a className="button" href="/teams/new">
              Create A Team
            </a>
          </div>

          {loading && !teams.length ? (
            <div className="state-card">
              <strong>Loading Teams…</strong>
            </div>
          ) : null}
          {!loading && !teams.length && !error ? (
            <div className="state-card">
              <strong>No Teams found.</strong>
              <p className="muted">Try a different search, city or houma.</p>
            </div>
          ) : null}
          {teams.length ? (
            <div className="team-discovery-grid">
              {teams.map((team) => (
                <TeamDiscoveryCard
                  key={team.id}
                  id={team.id}
                  name={team.name}
                  badgeUrl={team.badgeUrl}
                  bannerUrl={team.bannerUrl}
                  city={team.city}
                  houma={team.houma}
                  motto={team.motto}
                  playerCount={team._count.players}
                  challengeHref={
                    me && managedTeams.some((managed) => managed.id !== team.id)
                      ? "/teams/control"
                      : null
                  }
                />
              ))}
            </div>
          ) : null}
          {nextCursor ? (
            <button
              className="button secondary teams-load-more"
              type="button"
              disabled={loading}
              onClick={() => void loadMore()}
            >
              {loading ? "Loading…" : "Load more Teams"}
            </button>
          ) : null}
        </>
      ) : null}

      {tab === "mine" ? (
        !me ? (
          memberGate
        ) : (
          <section className="panel">
            <span className="eyebrow">MY TEAMS</span>
            <div className="teams-section-heading">
              <div>
                <h2>Your Teams</h2>
                <p className="muted">Teams where you are an active player.</p>
              </div>
            </div>
            {memberError ? <div className="error-box">{memberError}</div> : null}
            {memberLoading ? <p className="muted">Loading your Teams…</p> : null}
            {!memberLoading && !myTeams.length ? <p className="muted">No Teams yet.</p> : null}
            {myTeams.length ? (
              <div className="team-discovery-grid">
                {myTeams.map((team) => (
                  <TeamDiscoveryCard
                    key={team.id}
                    id={team.id}
                    name={team.name}
                    badgeUrl={team.badgeUrl}
                    bannerUrl={team.bannerUrl}
                    city={team.city}
                    houma={team.houma}
                    motto={team.motto}
                    playerCount={team._count.players}
                  />
                ))}
              </div>
            ) : null}
          </section>
        )
      ) : null}

      {tab === "requests" ? (
        !me ? (
          memberGate
        ) : (
          <section className="panel">
            <span className="eyebrow">COACH CONTROL ROOM</span>
            <div className="teams-section-heading">
              <div>
                <h2>Team requests</h2>
                <p className="muted">
                  Incoming and outgoing challenge requests for Teams you are authorized to manage.
                </p>
              </div>
              <a className="button secondary" href="/teams/control">
                Open Control Room
              </a>
            </div>
            {memberError ? <div className="error-box">{memberError}</div> : null}
            {memberLoading ? <p className="muted">Loading requests…</p> : null}
            {!memberLoading && !challenges.length ? (
              <p className="muted">No Team requests yet.</p>
            ) : null}
            <div className="challenge-list">
              {challenges.map((challenge) => {
                const incomingChallenge = managedIds.has(challenge.challengedTeamId);
                const outgoingChallenge = managedIds.has(challenge.challengerTeamId);
                return (
                  <article className="challenge-card" key={challenge.id}>
                    <div>
                      <span className="eyebrow">
                        {incomingChallenge ? "INCOMING" : "OUTGOING"} · {challenge.status}
                      </span>
                      <h3>
                        {challenge.challengerTeam.name} vs {challenge.challengedTeam.name}
                      </h3>
                      <p>
                        {challenge.format.replaceAll("_", " ")} ·{" "}
                        {friendlyDate(challenge.proposedAt)}
                      </p>
                      {challenge.message ? <p className="muted">{challenge.message}</p> : null}
                    </div>
                    {challenge.status === "PENDING" ? (
                      <div className="challenge-actions">
                        {incomingChallenge ? (
                          <>
                            <button
                              className="button"
                              type="button"
                              disabled={actingChallengeId === challenge.id}
                              onClick={() => void respondToChallenge(challenge.id, "accept")}
                            >
                              Accept
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              disabled={actingChallengeId === challenge.id}
                              onClick={() => void respondToChallenge(challenge.id, "decline")}
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                        {outgoingChallenge ? (
                          <button
                            className="button secondary"
                            type="button"
                            disabled={actingChallengeId === challenge.id}
                            onClick={() => void respondToChallenge(challenge.id, "cancel")}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        )
      ) : null}

      {tab === "games" ? (
        !me ? (
          memberGate
        ) : (
          <section className="panel">
            <span className="eyebrow">MATCHDAY</span>
            <div className="teams-section-heading">
              <div>
                <h2>Accepted games</h2>
                <p className="muted">
                  Accepted challenges become Team games without inventing missing schedule details.
                </p>
              </div>
              <a className="button secondary" href="/teams/control">
                Open Control Room
              </a>
            </div>
            {memberError ? <div className="error-box">{memberError}</div> : null}
            {memberLoading ? <p className="muted">Loading games…</p> : null}
            {!memberLoading && !games.length ? (
              <p className="muted">No accepted Team games yet.</p>
            ) : null}
            <div className="game-list">
              {games.map((game) => (
                <article className="team-game-card" key={game.id}>
                  <div>
                    <span className="eyebrow">{game.status}</span>
                    <h3>
                      {game.homeTeam.name} <em>vs</em> {game.awayTeam.name}
                    </h3>
                    <p>{friendlyDate(game.scheduledAt)}</p>
                  </div>
                  <strong>{game.status === "SCHEDULING" ? "TBA" : "MATCH"}</strong>
                </article>
              ))}
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}
