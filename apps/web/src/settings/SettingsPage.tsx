import { useEffect, useState, type FormEvent } from "react";
import type { LoginMethodsResponse } from "@hooma/contracts/auth-linking";
import {
  AppearanceSettings,
  type AppearanceMode,
} from "@hooma/ui";
import {
  attachWebCredential,
  readLoginMethods,
  startTelegramLink,
  useHoomaFrontend,
} from "@hooma/frontend";
import { useAccount } from "../account/AccountProvider";
import { getWebAppearanceMode, saveWebAppearanceMode } from "./theme";
import "./settings.css";

const WEB_CHOICES = [
  {
    value: "system",
    label: "System theme",
    description: "Follow your browser and operating-system appearance.",
  },
  {
    value: "dark",
    label: "Pitch black / gold",
    description: "Use HOOMA's primary dark football presentation.",
  },
  { value: "light", label: "Light", description: "Use a bright high-contrast HOOMA presentation." },
] as const satisfies readonly { value: AppearanceMode; label: string; description: string }[];

export function SettingsPage() {
  const [mode, setMode] = useState<AppearanceMode>(() => getWebAppearanceMode());
  const { me, loading: accountLoading } = useAccount();
  const { transport } = useHoomaFrontend();
  const [methods, setMethods] = useState<LoginMethodsResponse | null>(null);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [message, setMessage] = useState(() => loginMethodMessage());
  const [error, setError] = useState(() => loginMethodError());

  useEffect(() => {
    if (!me) {
      setMethods(null);
      return;
    }
    setMethodsLoading(true);
    setError("");
    void readLoginMethods(transport)
      .then(setMethods)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setMethodsLoading(false));
  }, [me, transport]);

  function updateMode(nextMode: AppearanceMode) {
    setMode(nextMode);
    saveWebAppearanceMode(nextMode);
  }

  async function connectTelegram() {
    setError("");
    setMessage("");
    try {
      const result = await startTelegramLink(transport, "/settings");
      if (!result.enabled || !result.authorizationUrl) {
        setError("Telegram Web login is not configured for this environment yet.");
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start Telegram linking");
    }
  }

  async function addWebLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const next = await attachWebCredential(transport, {
        loginUsername: String(data.get("loginUsername")),
        password: String(data.get("password")),
        email: String(data.get("email")) || null,
      });
      setMethods(next);
      setMessage("Web login added. You can now sign in to this same HOOMA account either way.");
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add Web login");
    }
  }

  return (
    <div className="settings-stack">
      <AppearanceSettings mode={mode} choices={WEB_CHOICES} onChange={updateMode} />

      <section className="settings-security" aria-labelledby="login-methods-title">
        <p className="eyebrow">SIGN-IN &amp; SECURITY</p>
        <h2 id="login-methods-title">Login methods</h2>
        <p className="settings-security__intro">
          Link another sign-in method only if you want it. Your profile, Teams and activity stay on
          one HOOMA account.
        </p>

        {accountLoading ? <p className="status">Loading account…</p> : null}
        {!accountLoading && !me ? (
          <p>
            <a href="/login?returnTo=%2Fsettings">Sign in</a> to manage login methods.
          </p>
        ) : null}
        {me && methodsLoading ? <p className="status">Loading login methods…</p> : null}

        {me && methods ? (
          <div className="login-methods">
            <article className="login-method-card">
              <div>
                <strong>Telegram</strong>
                <p>
                  {methods.telegram
                    ? methods.telegram.username
                      ? `Connected as @${methods.telegram.username}`
                      : "Connected"
                    : "Not connected"}
                </p>
              </div>
              {methods.telegram ? (
                <span className="login-method-status">Connected</span>
              ) : (
                <button type="button" onClick={() => void connectTelegram()}>
                  Connect Telegram
                </button>
              )}
            </article>

            <article className="login-method-card login-method-card--web">
              <div>
                <strong>Web login</strong>
                <p>
                  {methods.web ? `Connected as ${methods.web.loginUsername}` : "Not configured"}
                </p>
              </div>
              {methods.web ? (
                <span className="login-method-status">Connected</span>
              ) : (
                <form className="login-method-form" onSubmit={(event) => void addWebLogin(event)}>
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
                    Email (optional)
                    <input name="email" type="email" autoComplete="email" />
                  </label>
                  <button type="submit">Add Web login</button>
                </form>
              )}
            </article>
          </div>
        ) : null}

        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}

function loginMethodMessage(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("telegramLinked") === "success"
    ? "Telegram connected. You can now use either sign-in method for this same account."
    : "";
}

function loginMethodError(): string {
  const code = new URLSearchParams(window.location.search).get("telegramError");
  return code ? `Telegram connection failed (${code}).` : "";
}
