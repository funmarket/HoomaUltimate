import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { GamerGame } from "@hooma/contracts/gamers";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

export function GamersPage() {
  const { api, transport, protectedError, authenticationHref } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const [games, setGames] = useState<GamerGame[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await gamersApi.games();
      setGames(response.items);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [gamersApi]);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  useEffect(() => {
    let active = true;
    setAccountLoading(true);
    void api.identity
      .meOptional()
      .then((response) => {
        if (active) setMe(response);
      })
      .catch((reason) => {
        if (active) setMemberError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMemberError("");
    setNotice("");
    try {
      const created = await gamersApi.addGame({ name });
      setName("");
      setNotice(`${created.name} added to Gamers.`);
      await loadGames();
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to add this game"));
    } finally {
      setCreating(false);
    }
  }

  const accountHref = authenticationHref("/gamers");

  return (
    <div className="page gamers-page">
      <header className="gamers-hero panel">
        <span className="eyebrow">HOOMA GAMERS</span>
        <h1>Find the game. Find the challenger.</h1>
        <p>
          HOOMA connects players and records what people agree happened. The actual game stays in
          the game you already play.
        </p>
      </header>

      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      <section className="gamers-section" aria-labelledby="gamers-catalog-heading">
        <div className="gamers-section-heading">
          <div>
            <span className="eyebrow">GAME CATALOG</span>
            <h2 id="gamers-catalog-heading">Choose your game</h2>
          </div>
          <span className="gamers-count">{games.length} active</span>
        </div>

        {loading && !games.length ? (
          <div className="state-card">
            <strong>Loading games…</strong>
          </div>
        ) : null}
        {!loading && !games.length && !error ? (
          <div className="state-card">
            <strong>No active games yet.</strong>
            <p className="muted">HOOMA account holders can add the first game below.</p>
          </div>
        ) : null}
        {games.length ? (
          <div className="gamers-grid">
            {games.map((game) => (
              <a
                className="gamer-game-card"
                href={`/gamers/games/${encodeURIComponent(game.slug)}`}
                key={game.id}
              >
                <span className="gamer-game-mark" aria-hidden="true">
                  {game.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">ACTIVE GAME</span>
                  <h3>{game.name}</h3>
                  <p className="muted">
                    Open Challengers. Squads, Arena and Rankings follow in their own complete
                    slices.
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel gamers-add-panel" aria-labelledby="gamers-add-heading">
        <div>
          <span className="eyebrow">MISSING A GAME?</span>
          <h2 id="gamers-add-heading">Add it to HOOMA</h2>
          <p className="muted">
            Legitimate community-added games join the same persisted catalog. Obvious duplicate
            names are rejected rather than creating a second game.
          </p>
        </div>

        {memberError ? <div className="error-box">{memberError}</div> : null}
        {accountLoading ? <p className="muted">Checking your HOOMA account…</p> : null}
        {!accountLoading && me ? (
          <form className="gamers-add-form" onSubmit={addGame}>
            <label className="field">
              <span>Game name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Rocket League"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <button className="button" type="submit" disabled={creating || !name.trim()}>
              {creating ? "Adding…" : "Add Game"}
            </button>
          </form>
        ) : null}
        {!accountLoading && !me ? (
          <div className="member-gate">
            <strong>Public browsing stays open.</strong>
            <span className="muted">
              Create your HOOMA account only when you want to contribute or use member actions.
            </span>
            {accountHref ? (
              <a className="button secondary" href={accountHref}>
                Create HOOMA account to add a game
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
