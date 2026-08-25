import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useHoomaFrontend } from "@hooma/frontend";
import { useAccount } from "../account/AccountProvider";
import {
  completeGamerSignupOnboarding,
  GamerSignupFields,
  useGamerSignupSelection,
  validateGamerSignupSelection,
} from "./GamerSignupOnboarding";

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
  const gamerOnboarding = useGamerSignupSelection();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    const validationError = validateGamerSignupSelection(gamerOnboarding.selection);
    if (validationError) {
      onError(validationError);
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
      await completeGamerSignupOnboarding(gamerOnboarding.selection, transport);
      await onSuccess(gamerOnboarding.selection.enabled ? "/gamers" : undefined);
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
      <GamerSignupFields onboarding={gamerOnboarding} />
      <button
        type="submit"
        disabled={
          submitting ||
          (gamerOnboarding.selection.enabled && gamerOnboarding.selection.gamesLoading)
        }
      >
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
