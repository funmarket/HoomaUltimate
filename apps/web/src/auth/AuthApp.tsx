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

function initialMode(): "login" | "register" | "recover" {
  return window.location.pathname === "/register" ? "register" : "login";
}

export function AuthApp() {
  const { api } = useHoomaFrontend();
  const { me, loading, error: accountError, refresh } = useAccount();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "recover">(initialMode);
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

  function selectMode(nextMode: "login" | "register" | "recover") {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  function completePasswordRecovery() {
    setMode("login");
    setError("");
    setNotice("Password reset. Sign in with your new password.");
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
        <button type="button" aria-pressed={mode === "login"} onClick={() => selectMode("login")}>
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => selectMode("register")}
        >
          Create account
        </button>
      </div>
      {mode === "login" ? (
        <LoginForm
          onSuccess={completeAuthentication}
          onError={setError}
          onRecover={() => selectMode("recover")}
        />
      ) : mode === "register" ? (
        <RegisterForm
          onSuccess={completeAuthentication}
          onCreatedWithWarning={completeWithWarning}
          onError={setError}
        />
      ) : (
        <PasswordRecoveryForm
          onRecovered={completePasswordRecovery}
          onCancel={() => selectMode("login")}
          onError={setError}
        />
      )}
      {notice ? <p className="status">{notice}</p> : null}
      {visibleError ? <p className="error">{visibleError}</p> : null}
    </section>
  );
}

function LoginForm({ onSuccess, onError, onRecover }: LoginFormCallbacks) {
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
      <button type="button" onClick={onRecover}>
        Forgot password?
      </button>
    </form>
  );
}

function PasswordRecoveryForm({
  onRecovered,
  onCancel,
  onError,
}: {
  readonly onRecovered: () => void;
  readonly onCancel: () => void;
  readonly onError: (message: string) => void;
}) {
  const { api } = useHoomaFrontend();
  const [loginUsername, setLoginUsername] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const username = String(data.get("loginUsername")).trim();
    setBusy(true);
    try {
      await api.identity.requestPasswordRecovery({ loginUsername: username });
      setLoginUsername(username);
      setRequested(true);
      setMessage(
        "If this Web login has a linked Telegram account, HOOMA sent a one-time recovery code there.",
      );
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to request password recovery");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword"));
    const confirmPassword = String(data.get("confirmPassword"));
    if (newPassword !== confirmPassword) {
      onError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.identity.confirmPasswordRecovery({
        loginUsername,
        code: String(data.get("code")),
        newPassword,
      });
      onRecovered();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h2>Reset Web password</h2>
      {!requested ? (
        <form onSubmit={(event) => void requestCode(event)}>
          <p>
            Enter your Web login username. If that account is linked to Telegram, HOOMA will send a
            short-lived recovery code to the linked Telegram account.
          </p>
          <label>
            Login username
            <input name="loginUsername" autoComplete="username" required />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send recovery code"}
          </button>
        </form>
      ) : (
        <form onSubmit={(event) => void resetPassword(event)}>
          <p>{message}</p>
          <p>Web login: {loginUsername}</p>
          <label>
            Recovery code
            <input
              name="code"
              autoComplete="one-time-code"
              minLength={10}
              maxLength={11}
              required
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              minLength={10}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
      <button type="button" onClick={onCancel} disabled={busy}>
        Back to sign in
      </button>
    </>
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

type LoginFormCallbacks = FormCallbacks & {
  onRecover: () => void;
};

type RegisterFormCallbacks = FormCallbacks & {
  onCreatedWithWarning: (message: string) => void | Promise<void>;
};
