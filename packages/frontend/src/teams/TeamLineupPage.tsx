import { useEffect, useState } from "react";
import type { TeamControlDetail } from "../api";
import { useHoomaFrontend } from "../context";
import { TeamLineupManager } from "./TeamLineupManager";

type TeamLineupPageProps = {
  readonly teamId: string;
};

export function TeamLineupPage({ teamId }: TeamLineupPageProps) {
  const { api, protectedError } = useHoomaFrontend();
  const [team, setTeam] = useState<TeamControlDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    setTeam(null);

    void Promise.all([api.teams.managed(), api.teams.publicDetail(teamId)])
      .then(([managedTeams, detail]) => {
        if (!active) return;
        if (!managedTeams.some((candidate) => candidate.id === teamId)) {
          setError("You do not currently manage this Team.");
          return;
        }
        setTeam(detail);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(protectedError(reason, "Unable to open lineup control"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, protectedError, teamId]);

  async function runLineupAction(action: () => Promise<unknown>, success: string) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (reason) {
      setError(protectedError(reason, "Unable to save Team lineup"));
    }
  }

  if (loading) return <p className="status">Loading lineup control…</p>;

  return (
    <section className="control-room">
      <a href="/teams/control">← Team HQ</a>
      <header className="control-room__header">
        <div>
          <p className="eyebrow">TEAM HQ · LINEUP CONTROL</p>
          <h2>Build the shape</h2>
          <p>Draft, publish and update this Team&apos;s matchday lineup here.</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="success">{notice}</p> : null}

      {team ? (
        <>
          <section className="panel control-room__summary">
            <div>
              <span>Team</span>
              <strong>{team.name}</strong>
            </div>
            <div>
              <span>Roster</span>
              <strong>{team.players.length}</strong>
            </div>
            <a href={`/teams/${team.id}`}>Open public Team profile</a>
          </section>
          <TeamLineupManager key={team.id} api={api.teams} team={team} onRun={runLineupAction} />
        </>
      ) : null}
    </section>
  );
}
