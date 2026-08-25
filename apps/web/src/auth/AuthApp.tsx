import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useHoomaFrontend } from "@hooma/frontend";
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
  const { me, loading, refresh } = useAccount();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const returnTo = useMemo(safeReturnTo, []);

  useEffect(() => {
    if (!loading && me && returnTo !== "/") window.location.replace(returnTo);
  }, [loading, me, returnTo]);

  async function completeAuthentication() {
    try {
      await refresh();
      window.location.replace(returnTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh account state");
    }
  }

  async function signOut() {
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

  if (me) {
    return (
      <section className="auth-card">
        <p className="eyebrow">SIGNED IN</p>
        <h2>{me.presentation.displayName}</h2>
        <p>@{me.presentation.username}</p>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
        {error ? <p className="error">{error}</p> : null}
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
        <RegisterForm onSuccess={completeAuthentication} onError={setError} />
      )}
      {error ? <p className="error">{error}</p> : null}
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
          .then(onSuccess)
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

function RegisterForm({ onSuccess, onError }: FormCallbacks) {
  const { api } = useHoomaFrontend();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void api.identity
      .register({
        loginUsername: String(data.get("loginUsername")),
        password: String(data.get("password")),
        displayUsername: String(data.get("displayUsername")),
        displayName: String(data.get("displayName")) || null,
        email: String(data.get("email")) || null,
      })
      .then(onSuccess)
      .catch((error: Error) => onError(error.message));
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
      <button type="submit">Create account</button>
    </form>
  );
}

type FormCallbacks = {
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
};
