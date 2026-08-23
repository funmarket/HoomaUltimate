import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "@hooma/frontend";

function safeReturnTo(): string {
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function TelegramAccountActivationPage() {
  const { api, createAccountFromDeliveryIdentity } = useHoomaFrontend();
  const returnTo = useMemo(safeReturnTo, []);
  const [checking, setChecking] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api.identity.meOptional()
      .then((me) => {
        if (!active) return;
        if (me) window.location.replace(returnTo);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to check your HOOMA account");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [api, returnTo]);

  async function createAccount() {
    setCreating(true);
    setError("");
    try {
      await createAccountFromDeliveryIdentity();
      await api.identity.me();
      window.location.replace(returnTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your HOOMA account");
      setCreating(false);
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">HOOMA ACCOUNT</p>
      <h2>Create your HOOMA profile</h2>
      <p>
        Browsing stays open without an account. Create your HOOMA profile only when you want to
        join, create, play, contribute, challenge or use member-only features.
      </p>
      {checking ? <p className="status">Checking your HOOMA account…</p> : null}
      {!checking ? (
        <button type="button" disabled={creating} onClick={() => void createAccount()}>
          {creating ? "Creating…" : "Create HOOMA account"}
        </button>
      ) : null}
      <a href={returnTo}>Keep browsing</a>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
