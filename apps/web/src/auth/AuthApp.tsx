import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { GamerGame } from "@hooma/contracts/gamers";
import { useHoomaFrontend } from "@hooma/frontend";
import { createGamerSignupOnboardingApi } from "@hooma/frontend/gamers-signup-onboarding";
import { useAccount } from "../account/AccountProvider";

function safeReturnTo(): string {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function initialMode(): "login" | "register" {
  return window.location.pathname === "/register" ? "register" : "login";
}

export function AuthApp() {
  const { api } = useHoomaFrontend();
  const { me, loading, error: accountError, refresh } = useAccount();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const returnTo = useMemo(safeReturnTo, []);

  useEffect(() => {
    if (!loading && me && returnTo !== "/") window.location.replace(returnTo);
  }, [loading, me, returnTo]);

  async function completeAuthentication(nextPath?: string) {
    setError("");
    if (await refresh()) {
      window.location.replace(returnTo !== "/" ? returnTo : (nextPath ?? "/"));
    }
  }

  async function completeWithWarning(message: string) {
    setError(message);
    await refresh();
  }

  async function signOut() {
    setError("");
    try {
      await api.identity.logout();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign out");
    }
  }

  if (loading) {
    return (
      <section className="auth-card" aria-busy="true">
        <p className="status">Loading account…</p>
      </section>
    );
  }

  const visibleError = error || accountError;

  if (me) {
    return (
      <section className="auth-card">
        <p className="eyebrow">SIGNED IN</p>
        <h2>{me.presentation.displayName}</h2>
        <p>@{me.presentation.username}</p>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
        {visibleError ? <p className="error">{visibleError}</p> : null}
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs">
        <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>
      {mode === "login" ? (
        <LoginForm onSuccess={completeAuthentication} onError={setError} />
      ) : (
        <RegisterForm
          onSuccess={completeAuthentication}
          onCreatedWithWarning={completeWithWarning}
          onError={setError}
        />
      )}
      {visibleError ? <p className="error">{visibleError}</p> : null}
    </section>
  );
}

function LoginForm({ onSuccess, onError }: FormCallbacks) {
  const { api } = useHoomaFrontend();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void api.identity
          .login({
            loginUsername: String(data.get("loginUsername")),
            password: String(data.get("password")),
          })
          .then(() => onSuccess())
          .catch((error: Error) => onError(error.message));
      }}
    >
      <label>
        Login username
        <input name="loginUsername" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit">Sign in</button>
    </form>
  );
}

function RegisterForm({ onSuccess, onCreatedWithWarning, onError }: RegisterFormCallbacks) {
  const { api, transport } = useHoomaFrontend();
  const gamerOnboarding = useMemo(() => createGamerSignupOnboardingApi(transport), [transport]);
  const [games, setGames] = useState<GamerGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState("");
  const [gamerSignup, setGamerSignup] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [handles, setHandles] = useState<Record<string, string>>({});
  const [openToChallenge, setOpenToChallenge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setGamesLoading(true);
    setGamesError("");
    void gamerOnboarding
      .games()
      .then((response) => {
        if (active) setGames(response.items);
      })
      .catch((reason) => {
        if (active) {
          setGamesError(reason instanceof Error ? reason.message : "Unable to load Gamer games");
        }
      })
      .finally(() => {
        if (active) setGamesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gamerOnboarding]);

  function toggleGame(gameId: string, selected: boolean) {
    setSelectedGameIds((current) =>
      selected ? [...new Set([...current, gameId])] : current.filter((id) => id !== gameId),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");

    const selectedGames = games.filter((game) => selectedGameIds.includes(game.id));
    if (gamerSignup && selectedGames.length === 0) {
      onError("Choose at least one game to finish Gamer setup during signup.");
      return;
    }
    const missingHandle = selectedGames.find((game) => !handles[game.id]?.trim());
    if (gamerSignup && missingHandle) {
      onError(`Enter your ${missingHandle.name} handle.`);
      return;
    }

    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    let accountCreated = false;
    try {
      await api.identity.register({
        loginUsername: String(data.get("loginUsername")),
        password: String(data.get("password")),
        displayUsername: String(data.get("displayUsername")),
        displayName: String(data.get("displayName")) || null,
        email: String(data.get("email")) || null,
      });
      accountCreated = true;

      if (gamerSignup) {
        const profile = await gamerOnboarding.profile();
        await gamerOnboarding.updateProfile({
          username: profile.presentation.username,
          displayName: profile.presentation.displayName,
          photoUrl: profile.presentation.photoUrl,
          bio: profile.presentation.bio,
          identities: [...new Set([...profile.identities, "GAMER" as const])],
          player: profile.player
            ? {
                skillLevel: profile.player.skillLevel,
                preferredPositions: profile.player.preferredPositions,
              }
            : null,
        });
        await Promise.all(
          selectedGames.map((game) =>
            gamerOnboarding.saveGameProfile(game, {
              handle: handles[game.id]!.trim(),
              openToChallenge,
            }),
          ),
        );
      }

      await onSuccess(gamerSignup ? "/gamers" : undefined);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to create account";
      if (accountCreated) {
        await onCreatedWithWarning(
          `Your HOOMA account was created, but Gamer setup did not finish: ${message}`,
        );
      } else {
        onError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Login username
        <input name="loginUsername" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          minLength={10}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Display username
        <input name="displayUsername" required />
      </label>
      <label>
        Display name
        <input name="displayName" />
      </label>
      <label>
        Email (optional)
        <input name="email" type="email" autoComplete="email" />
      </label>

      <label>
        <input
          type="checkbox"
          checked={gamerSignup}
          onChange={(event) => setGamerSignup(event.target.checked)}
        />
        I’m a Gamer
      </label>
      {gamerSignup ? (
        <fieldset>
          <legend>Games I play</legend>
          <p>
            Choose at least one game and enter the handle you actually use there. HOOMA will create
            those game profiles now so you do not have to repeat setup in Gamers.
          </p>
          {gamesLoading ? <p className="status">Loading games…</p> : null}
          {gamesError ? <p className="error">{gamesError}</p> : null}
          {!gamesLoading && !gamesError && games.length === 0 ? (
            <p>No Gamer games are available yet.</p>
          ) : null}
          {games.map((game) => {
            const selected = selectedGameIds.includes(game.id);
            return (
              <div key={game.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleGame(game.id, event.target.checked)}
                  />
                  {game.name}
                </label>
                {selected ? (
                  <label>
                    {game.name} handle
                    <input
                      value={handles[game.id] ?? ""}
                      onChange={(event) =>
                        setHandles((current) => ({ ...current, [game.id]: event.target.value }))
                      }
                      maxLength={100}
                      required
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          <label>
            <input
              type="checkbox"
              checked={openToChallenge}
              onChange={(event) => setOpenToChallenge(event.target.checked)}
            />
            Show my selected game profiles in Challengers
          </label>
        </fieldset>
      ) : null}

      <button type="submit" disabled={submitting || (gamerSignup && gamesLoading)}>
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

type FormCallbacks = {
  onSuccess: (nextPath?: string) => void | Promise<void>;
  onError: (message: string) => void;
};

type RegisterFormCallbacks = FormCallbacks & {
  onCreatedWithWarning: (message: string) => void | Promise<void>;
};
