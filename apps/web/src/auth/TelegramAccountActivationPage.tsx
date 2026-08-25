import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "@hooma/frontend";
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

export function TelegramAccountActivationPage() {
  const { api, transport, createAccountFromDeliveryIdentity } = useHoomaFrontend();
  const returnTo = useMemo(safeReturnTo, []);
  const gamerOnboarding = useGamerSignupSelection();
  const [checking, setChecking] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((me) => {
        if (!active) return;
        if (me) window.location.replace(returnTo);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to check your HOOMA account");
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [api, returnTo]);

  async function createAccount() {
    const validationError = validateGamerSignupSelection(gamerOnboarding.selection);
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    setError("");
    let created = false;
    try {
      await createAccountFromDeliveryIdentity();
      created = true;
      setAccountCreated(true);
      await api.identity.me();
      await completeGamerSignupOnboarding(gamerOnboarding.selection, transport);
      window.location.replace(
        returnTo !== "/" ? returnTo : gamerOnboarding.selection.enabled ? "/gamers" : "/",
      );
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Unable to create your HOOMA account";
      setError(
        created
          ? `Your HOOMA account was created, but Gamer setup did not finish: ${message}`
          : message,
      );
    } finally {
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
      {!accountCreated ? <GamerSignupFields onboarding={gamerOnboarding} /> : null}
      {checking ? <p className="status">Checking your HOOMA account…</p> : null}
      {!checking && !accountCreated ? (
        <button
          type="button"
          disabled={
            creating ||
            (gamerOnboarding.selection.enabled && gamerOnboarding.selection.gamesLoading)
          }
          onClick={() => void createAccount()}
        >
          {creating ? "Creating…" : "Create HOOMA account"}
        </button>
      ) : null}
      {accountCreated ? (
        <a href="/gamers">Continue to Gamers</a>
      ) : (
        <a href={returnTo}>Keep browsing</a>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
