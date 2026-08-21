import { FormEvent, useEffect, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { webApi } from "../api/client";

export function AuthApp() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    void webApi.me().then(setMe).catch(() => undefined);
  }, []);

  if (me) {
    return (
      <section className="auth-card">
        <p className="eyebrow">SIGNED IN</p>
        <h2>{me.presentation.displayName}</h2>
        <p>@{me.presentation.username}</p>
        <button
          type="button"
          onClick={() => void webApi.logout().then(() => setMe(null)).catch((e: Error) => setError(e.message))}
        >
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
        <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>
          Create account
        </button>
      </div>
      {mode === "login" ? (
        <LoginForm onSuccess={() => void webApi.me().then(setMe)} onError={setError} />
      ) : (
        <RegisterForm onSuccess={() => void webApi.me().then(setMe)} onError={setError} />
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function LoginForm({ onSuccess, onError }: FormCallbacks) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void webApi
          .login({ loginUsername: String(data.get("loginUsername")), password: String(data.get("password")) })
          .then(onSuccess)
          .catch((error: Error) => onError(error.message));
      }}
    >
      <label>Login username<input name="loginUsername" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit">Sign in</button>
    </form>
  );
}

function RegisterForm({ onSuccess, onError }: FormCallbacks) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void webApi
      .register({
        loginUsername: String(data.get("loginUsername")),
        password: String(data.get("password")),
        displayUsername: String(data.get("displayUsername")),
        displayName: String(data.get("displayName")) || null,
        email: String(data.get("email")) || null
      })
      .then(onSuccess)
      .catch((error: Error) => onError(error.message));
  }
  return (
    <form onSubmit={submit}>
      <label>Login username<input name="loginUsername" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" minLength={10} autoComplete="new-password" required /></label>
      <label>Display username<input name="displayUsername" required /></label>
      <label>Display name<input name="displayName" /></label>
      <label>Email (optional)<input name="email" type="email" autoComplete="email" /></label>
      <button type="submit">Create account</button>
    </form>
  );
}

type FormCallbacks = { onSuccess: () => void; onError: (message: string) => void };
