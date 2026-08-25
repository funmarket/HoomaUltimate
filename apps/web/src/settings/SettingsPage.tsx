import { useEffect, useState, type FormEvent } from "react";
import type { LoginMethodsResponse, TelegramLinkCodeResponse } from "@hooma/contracts/auth-linking";
import {
  attachWebCredential,
  claimTelegramLink,
  createTelegramLinkCode,
  readLoginMethods,
  useHoomaFrontend,
} from "@hooma/frontend";
import { AppearanceSettings, type AppearanceMode } from "@hooma/ui";
import { useAccount } from "../account/AccountProvider";
import { getWebAppearanceMode, saveWebAppearanceMode } from "./theme";

const WEB_CHOICES = [
  {
    value: "system",
    label: "System theme",
    description: "Use HOOMA's default black system appearance.",
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
  const { me, loading: accountLoading, refresh } = useAccount();
  const { transport } = useHoomaFrontend();
  const [methods, setMethods] = useState<LoginMethodsResponse | null>(null);
  const [linkCode, setLinkCode] = useState<TelegramLinkCodeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const telegramRuntime = Boolean(
    (
      window as Window & {
        Telegram?: { WebApp?: { initData?: string } };
      }
    ).Telegram?.WebApp?.initData,
  );

  useEffect(() => {
    if (!me) {
      setMethods(null);
      return;
    }
    let active = true;
    void readLoginMethods(transport)
      .then((next) => {
        if (active) setMethods(next);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [me, transport]);

  function updateMode(nextMode: AppearanceMode) {
    setMode(nextMode);
    saveWebAppearanceMode(nextMode);
  }

  async function addWebLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const next = await attachWebCredential(transport, {
        loginUsername: String(data.get("loginUsername")),
        password: String(data.get("password")),
        email: String(data.get("email")) || null,
      });
      setMethods(next);
      setMessage("Web login added to this HOOMA account.");
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add Web login");
    } finally {
      setBusy(false);
    }
  }

  async function generateTelegramCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setLinkCode(await createTelegramLinkCode(transport));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create Telegram link code");
    } finally {
      setBusy(false);
    }
  }

  async function connectTelegramAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await claimTelegramLink(transport, {
        loginUsername: String(data.get("loginUsername")),
        code: String(data.get("code")),
      });
      if (!(await refresh())) {
        throw new Error("Telegram was linked, but the account could not be refreshed");
      }
      setMessage("Telegram connected to your existing HOOMA account.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to connect Telegram");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      <AppearanceSettings mode={mode} choices={WEB_CHOICES} onChange={updateMode} />

      <section className="auth-card" aria-labelledby="login-methods-title">
        <p className="eyebrow">SIGN-IN &amp; SECURITY</p>
        <h2 id="login-methods-title">Login methods</h2>
        <p>
          Web and Telegram can sign in to the same HOOMA account. Linking is optional and never
          creates or merges accounts by username.
        </p>

        {accountLoading ? <p className="status">Loading account…</p> : null}

        {!accountLoading && me && methods ? (
          <>
            <p>
              Web login: {methods.web ? `Connected as ${methods.web.loginUsername}` : "Not added"}
            </p>
            <p>
              Telegram: {methods.telegram ? methods.telegram.username || "Connected" : "Not connected"}
            </p>

            {!methods.web ? (
              <form onSubmit={(event) => void addWebLogin(event)}>
                <h3>Add Web login</h3>
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
                <button type="submit" disabled={busy}>
                  {busy ? "Adding…" : "Add Web login"}
                </button>
              </form>
            ) : null}

            {!methods.telegram && me.transports.includes("web") ? (
              <div>
                <h3>Connect Telegram</h3>
                <p>
                  Create a short-lived code here, then open HOOMA Settings inside Telegram and enter
                  the Web login username and code shown below.
                </p>
                <button type="button" disabled={busy} onClick={() => void generateTelegramCode()}>
                  {busy ? "Creating…" : "Create Telegram link code"}
                </button>
                {linkCode ? (
                  <div className="status">
                    <p>Web login: {linkCode.loginUsername}</p>
                    <p>Code: {linkCode.code}</p>
                    <p>Expires: {new Date(linkCode.expiresAt).toLocaleTimeString()}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {!accountLoading && !me && telegramRuntime ? (
          <form onSubmit={(event) => void connectTelegramAccount(event)}>
            <h3>Connect this Telegram account</h3>
            <p>Enter the Web login username and link code created from HOOMA Web Settings.</p>
            <label>
              Web login username
              <input name="loginUsername" autoComplete="username" required />
            </label>
            <label>
              Link code
              <input name="code" autoComplete="one-time-code" minLength={16} maxLength={16} required />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect Telegram"}
            </button>
          </form>
        ) : null}

        {!accountLoading && !me && !telegramRuntime ? (
          <p>
            <a href="/login?returnTo=%2Fsettings">Sign in</a> to manage your login methods.
          </p>
        ) : null}

        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  );
}
