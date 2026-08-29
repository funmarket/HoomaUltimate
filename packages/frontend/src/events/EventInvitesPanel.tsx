import { useCallback, useEffect, useState } from "react";
import { useHoomaFrontend } from "../context";
import type { EventPlayerInvite } from "./api";
import { useEventApi } from "./useEventApi";

export function EventInvitesPanel() {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const [invites, setInvites] = useState<EventPlayerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setInvites(await eventApi.incomingInvites());
  }, [eventApi]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void eventApi
      .incomingInvites()
      .then((incoming) => {
        if (active) setInvites(incoming);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load game invitations"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventApi, protectedError]);

  async function accept(invite: EventPlayerInvite) {
    setBusyInviteId(invite.id);
    setError("");
    try {
      await eventApi.acceptInvite(invite.id);
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Unable to accept game invitation"));
    } finally {
      setBusyInviteId(null);
    }
  }

  async function decline(invite: EventPlayerInvite) {
    setBusyInviteId(invite.id);
    setError("");
    try {
      await eventApi.declineInvite(invite.id);
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Unable to decline game invitation"));
    } finally {
      setBusyInviteId(null);
    }
  }

  if (loading) return null;
  if (!invites.length && !error) return null;

  return (
    <section className="panel team-offers-panel">
      <div>
        <p className="eyebrow">GAME INVITATIONS</p>
        <h3>Organizers invited you</h3>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="team-offers-list">
        {invites.map((invite) => (
          <article className="team-offer-request" key={invite.id}>
            <div className="team-offer-request__team">
              <div>
                <strong>{invite.event.title}</strong>
                <span>{formatInviteDate(invite.event.startsAt)}</span>
              </div>
            </div>
            <div className="team-offer-request__actions">
              <button
                type="button"
                className="button"
                disabled={busyInviteId === invite.id}
                onClick={() => void accept(invite)}
              >
                {busyInviteId === invite.id ? "Working…" : "Accept Invite"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busyInviteId === invite.id}
                onClick={() => void decline(invite)}
              >
                Decline
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatInviteDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
