import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TeamCapabilityInput, TeamChallengeCreateInput } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import type { ManagedTeam, TeamChallengeSummary, TeamControlDetail } from "../api";

const CAPABILITIES: readonly TeamCapabilityInput[] = [
  "EDIT_TEAM",
  "MANAGE_ROSTER",
  "MANAGE_LINEUP",
  "CREATE_CHALLENGE",
  "RESPOND_TO_CHALLENGE",
  "MANAGE_TEAM_EVENTS"
];

export function CoachControlRoomPage() {
  const { api, protectedError } = useHoomaFrontend();
  const [teams, setTeams] = useState<ManagedTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [team, setTeam] = useState<TeamControlDetail | null>(null);
  const [incoming, setIncoming] = useState<TeamChallengeSummary[]>([]);
  const [outgoing, setOutgoing] = useState<TeamChallengeSummary[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = useMemo(
    () => teams.find((candidate) => candidate.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  useEffect(() => {
    void reloadManagedTeams();
    void reloadChallenges();
  }, [api]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTeam(null);
      return;
    }
    void api.teams.publicDetail(selectedTeamId).then(setTeam).catch(reportError);
  }, [api, selectedTeamId]);

  async function reloadManagedTeams() {
    try {
      const rows = await api.teams.managed();
      setTeams(rows);
      setSelectedTeamId((current) => current || rows[0]?.id || "");
    } catch (reason) {
      reportError(reason);
    }
  }

  async function reloadSelectedTeam() {
    if (selectedTeamId) setTeam(await api.teams.publicDetail(selectedTeamId));
  }

  async function reloadChallenges() {
    try {
      const [incomingRows, outgoingRows] = await Promise.all([
        api.teams.incomingChallenges(),
        api.teams.outgoingChallenges()
      ]);
      setIncoming(incomingRows);
      setOutgoing(outgoingRows);
    } catch (reason) {
      reportError(reason);
    }
  }

  function reportError(reason: unknown) {
    setError(protectedError(reason, "Unexpected Team error"));
  }

  async function runAction(action: () => Promise<unknown>, success: string, refreshTeam = true) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      if (refreshTeam) await reloadSelectedTeam();
      await reloadManagedTeams();
      await reloadChallenges();
    } catch (reason) {
      reportError(reason);
    }
  }

  if (!teams.length && !error) return <p className="status">Loading your managed Teams…</p>;

  return (
    <section className="control-room">
      <header className="control-room__header">
        <div>
          <p className="eyebrow">TEAM MANAGEMENT</p>
          <h2>Coach Control Room</h2>
          <p>Coach and delegated Assistant actions use the same protected Team API.</p>
        </div>
        <label>
          Managed Team
          <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
            {teams.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="success">{notice}</p> : null}
      {!selected ? <p className="status">You do not currently manage a Team.</p> : null}
      {selected && team ? (
        <>
          <section className="panel control-room__summary">
            <div>
              <span>Team</span>
              <strong>{team.name}</strong>
            </div>
            <div>
              <span>Houma</span>
              <strong>{team.houma || team.city || "—"}</strong>
            </div>
            <a href={`/teams/${team.id}`}>Open public Team profile</a>
          </section>
          <div className="control-room__grid">
            <EditTeamCard api={api.teams} team={team} onRun={runAction} />
            <RosterCard api={api.teams} team={team} onRun={runAction} />
            <AssistantCard api={api.teams} team={team} onRun={runAction} />
            <CreateChallengeCard api={api.teams} team={team} managedTeams={teams} onRun={runAction} />
          </div>
          <LineupControlCard team={team} />
          <ChallengeBoard api={api.teams} incoming={incoming} outgoing={outgoing} onRun={runAction} />
        </>
      ) : null}
    </section>
  );
}

type TeamApi = ReturnType<typeof import("../api").createHoomaApi>["teams"];
type RunAction = (action: () => Promise<unknown>, success: string, refreshTeam?: boolean) => Promise<void>;
type CardProps = { api: TeamApi; team: TeamControlDetail; onRun: RunAction };

function LineupControlCard({ team }: { team: TeamControlDetail }) {
  return (
    <section className="panel">
      <p className="eyebrow">MATCHDAY SHAPE</p>
      <h3>Lineup control</h3>
      <p>The lineup builder is the dedicated Team lineup editor. Draft, publish and update the matchday shape there.</p>
      <a href={`/teams/${team.id}/lineup`}>Open builder</a>
    </section>
  );
}

function EditTeamCard({ api, team, onRun }: CardProps) {
  return (
    <section className="panel">
      <h3>Edit Team</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void onRun(
            () =>
              api.update(team.id, {
                name: String(data.get("name")),
                motto: String(data.get("motto")) || null,
                city: String(data.get("city")) || null,
                houma: String(data.get("houma")) || null
              }),
            "Team updated."
          );
        }}
      >
        <label>
          Name
          <input name="name" defaultValue={team.name} required />
        </label>
        <label>
          Motto
          <input name="motto" defaultValue={team.motto ?? ""} />
        </label>
        <label>
          City
          <input name="city" defaultValue={team.city ?? ""} />
        </label>
        <label>
          Houma
          <input name="houma" defaultValue={team.houma ?? ""} />
        </label>
        <button type="submit">Save Team</button>
      </form>
    </section>
  );
}

function RosterCard({ api, team, onRun }: CardProps) {
  return (
    <section className="panel">
      <h3>Roster</h3>
      <div className="control-list">
        {team.players.map((player) => (
          <div key={player.userId}>
            <span>{player.user.presentation?.displayName ?? player.userId}</span>
            <button type="button" onClick={() => void onRun(() => api.removePlayer(team.id, player.userId), "Player removed.")}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void onRun(() => api.addPlayer(team.id, String(data.get("userId"))), "Player added.").then(() => form.reset());
        }}
      >
        <label>
          HOOMA User ID
          <input name="userId" required />
        </label>
        <button type="submit">Add player</button>
      </form>
    </section>
  );
}

function AssistantCard({ api, team, onRun }: CardProps) {
  return (
    <section className="panel">
      <h3>Assistant</h3>
      <div className="control-list">
        {team.responsibilities
          .filter((row) => row.role === "ASSISTANT")
          .map((assistant) => (
            <div key={assistant.userId}>
              <span>{assistant.user.presentation?.displayName ?? assistant.userId}</span>
              <button type="button" onClick={() => void onRun(() => api.revokeAssistant(team.id, assistant.userId), "Assistant authority revoked.")}>
                Revoke
              </button>
            </div>
          ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const capabilities = CAPABILITIES.filter((capability) => data.getAll("capability").includes(capability));
          void onRun(() => api.assignAssistant(team.id, String(data.get("userId")), capabilities), "Assistant capabilities saved.").then(() => form.reset());
        }}
      >
        <label>
          User ID
          <input name="userId" required />
        </label>
        <fieldset>
          <legend>Delegated capabilities</legend>
          {CAPABILITIES.map((capability) => (
            <label className="check-row" key={capability}>
              <input type="checkbox" name="capability" value={capability} />
              {humanize(capability)}
            </label>
          ))}
        </fieldset>
        <button type="submit">Assign / update Assistant</button>
      </form>
    </section>
  );
}

function CreateChallengeCard({ api, team, managedTeams, onRun }: CardProps & { managedTeams: ManagedTeam[] }) {
  return (
    <section className="panel">
      <h3>Create Challenge</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void onRun(
            () =>
              api.createChallenge({
                challengerTeamId: team.id,
                challengedTeamId: String(data.get("challengedTeamId")),
                format: String(data.get("format")) as TeamChallengeCreateInput["format"],
                message: String(data.get("message")) || null,
                proposedAt: null
              }),
            "Challenge sent.",
            false
          ).then(() => form.reset());
        }}
      >
        <label>
          Opponent Team ID
          <input name="challengedTeamId" required />
        </label>
        <label>
          Format
          <select name="format" defaultValue="FIVE_V_FIVE">
            <option value="FIVE_V_FIVE">5 v 5</option>
            <option value="SEVEN_V_SEVEN">7 v 7</option>
            <option value="ELEVEN_V_ELEVEN">11 v 11</option>
          </select>
        </label>
        <label>
          Message
          <textarea name="message" rows={3} />
        </label>
        <button type="submit">Send challenge</button>
      </form>
      {managedTeams.length > 1 ? <small>Managed Teams cannot challenge themselves; the server enforces that rule.</small> : null}
    </section>
  );
}

function ChallengeBoard({
  api,
  incoming,
  outgoing,
  onRun
}: {
  api: TeamApi;
  incoming: TeamChallengeSummary[];
  outgoing: TeamChallengeSummary[];
  onRun: RunAction;
}) {
  return (
    <section className="panel challenge-board">
      <h3>Challenges</h3>
      <div className="challenge-columns">
        <div>
          <h4>Incoming</h4>
          {incoming.map((challenge) => (
            <ChallengeRow
              key={challenge.id}
              challenge={challenge}
              actions={
                challenge.status === "PENDING" ? (
                  <>
                    <button type="button" onClick={() => void onRun(() => api.acceptChallenge(challenge.id), "Challenge accepted.", false)}>
                      Accept
                    </button>
                    <button type="button" onClick={() => void onRun(() => api.declineChallenge(challenge.id), "Challenge declined.", false)}>
                      Decline
                    </button>
                  </>
                ) : null
              }
            />
          ))}
        </div>
        <div>
          <h4>Outgoing</h4>
          {outgoing.map((challenge) => (
            <ChallengeRow
              key={challenge.id}
              challenge={challenge}
              actions={
                challenge.status === "PENDING" ? (
                  <button type="button" onClick={() => void onRun(() => api.cancelChallenge(challenge.id), "Challenge cancelled.", false)}>
                    Cancel
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChallengeRow({ challenge, actions }: { challenge: TeamChallengeSummary; actions: ReactNode }) {
  return (
    <article className="challenge-row">
      <div>
        <strong>
          {challenge.challengerTeam.name} → {challenge.challengedTeam.name}
        </strong>
        <span>{challenge.status}</span>
      </div>
      <div className="challenge-actions">
        {actions}
        <a href={`/teams/challenges/${challenge.id}`}>Open</a>
      </div>
    </article>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
