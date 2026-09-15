import { useEffect, useState } from "react";
import { useHoomaFrontend } from "../context";
import type { EventParticipationActions } from "./api";
import { useEventApi } from "./useEventApi";

export function CheckInPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const [actions, setActions] = useState<EventParticipationActions | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void eventApi
      .myRsvp(eventId)
      .then((result) => {
        if (active) setActions(result.actions);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load check-in state"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventApi, eventId, protectedError]);

  function runCheckIn(latitude?: number, longitude?: number, success = "Checked in.") {
    void eventApi
      .checkIn(eventId, latitude, longitude)
      .then(async () => {
        setMessage(success);
        const result = await eventApi.myRsvp(eventId);
        setActions(result.actions);
      })
      .catch((reason) => setError(protectedError(reason, "Unable to check in")));
  }

  function checkIn() {
    if (!actions?.canCheckIn) return;
    setError("");
    setMessage("");
    if (!navigator.geolocation) {
      runCheckIn();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => runCheckIn(position.coords.latitude, position.coords.longitude),
      () => runCheckIn(undefined, undefined, "Checked in without location."),
    );
  }

  const unavailable =
    actions?.checkInUnavailableReason === "TOO_EARLY"
      ? `Check-in opens ${new Date(actions.checkInOpensAt).toLocaleString()}.`
      : actions?.checkInUnavailableReason === "CREATOR"
        ? "Event creators do not use participant check-in."
        : actions?.checkInUnavailableReason === "ALREADY_ATTENDED"
          ? "You are already checked in."
          : actions && !actions.canCheckIn
            ? "Check-in is not available for your current Event participation state."
            : "";

  return (
    <section className="panel">
      <p className="eyebrow">CHECK-IN</p>
      <h2>Confirm you arrived</h2>
      <p>Location is optional. RSVP authority is always checked on the server.</p>
      <button type="button" disabled={loading || !actions?.canCheckIn} onClick={checkIn}>
        {loading ? "Checking eligibility…" : actions?.attended ? "Checked in" : "Check in"}
      </button>
      {unavailable ? <p className="status">{unavailable}</p> : null}
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
