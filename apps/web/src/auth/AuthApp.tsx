import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  startTelegramLink,
  startTelegramWebLogin,
  useHoomaFrontend,
} from "@hooma/frontend";
import { useAccount } from "../account/AccountProvider";

function safeReturnTo(): string {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function initialMode(): "login" | "register" {
  return window.location.pathname === "/register" ? "register" : "login";
}

function telegramError(): string {
  const code = new URLSearchParams(window.location.search).get("telegramError");
  return code ? `Telegram sign-in failed (${code}).` : "";
}

export function AuthApp() {
  const { api, transport } = useHoomaFrontend();
  const { me, loading, error: accountError, refresh } = useAccount();
  const [error, setError] = useState(telegramError);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [telegramStarting, setTelegramStarting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const returnTo = useMemo(safeReturnTo, []);

  useEffect(() => {
    if (!registrationComplete && !loading && me && returnTo !== "/") {
      window.location.replace(returnTo);
    }
  }, [loading, me, registrationComplete, returnTo]);

  async function completeAuthentication() {
    setError("");
    if (await refresh()) {
      window.location.replace(returnTo);
    }
  }

  async function completeRegistration() {
    setError("");
    setRegistrationComplete(true);
    if (!(await refresh())) {
      setRegistrationComplete(false);
    }
  }

  async function signOut() {
    setError("");
    try {
      await api.identity.logout();
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to sign out",
      );
    }
  }

  async function continueWithTelegram() {
    setError("");
    setTelegramStarting(true);
    try {
      const result = await startTelegramWebLogin(transport, returnTo);
      if (!result.enabled || !result.authorizationUrl) {
        setError(
          "Telegram Web login is not configured for this environment yet.",
        );
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to start Telegram sign-in",
      );
    } finally {
      setTelegramStarting(false);
    }
  }

  async function connectTelegramAfterRegistration() {
    setError("");
    setTelegramStarting(true);
    try {
      const result = await startTelegramLink(transport, returnTo);
      if (!result.enabled || !result.authorizationUrl) {
        setError(
          "Telegram Web login is not configured for this environment yet.",
        );
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to start Telegram linking",
      );
    } finally {
      setTelegramStarting(false);
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

  if (registrationComplete && me) {
    return (
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT CREATED</p>
        <h2>Connect Telegram?</h2>
        <p>
          Optional. Connect Telegram if you also want to use this same HOOMA
          account through Telegram. You can always do this later in Settings.
        </p>
        <button
          type="button"
          disabled={telegramStarting}
          onClick={() => void connectTelegramAfterRegistration()}
        >
          {telegramStarting ? "Opening Telegram…" : "Connect Telegram"}
        </button>
        <button
          type="button"
          onClick={() => window.location.replace(returnTo)}
        >
          Maybe later
        </button>
        {visibleError ? <p className="error">{visibleError}</p> : null}
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
        {visibleError ? <p className="error">{visibleError}</p> : null}
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => setMode("login")}
        >
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
        <RegisterForm onSuccess={completeRegistration} onError={setError} />
      )}
      {mode === "login" ? (
        <>
          <p className="status">or</p>
          <button
            type="button"
            disabled={telegramStarting}
            onClick={() => void continueWithTelegram()}
          >
            {telegramStarting ? "Opening Telegram…" : "Continue with Telegram"}
          </button>
        </>
      ) : (
        <p className="status">
          Telegram is optional. After creating your Web account you can connect
          it now or later in Settings.
        </p>
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
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
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
