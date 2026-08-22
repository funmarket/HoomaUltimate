import { useState } from "react";
import { protectedActionError } from "../auth/auth-redirect";
import { eventApi } from "../api/event-client";

export function CheckInPage({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function runCheckIn(latitude?: number, longitude?: number, success = "Checked in.") {
    void eventApi
      .checkIn(eventId, latitude, longitude)
      .then(() => setMessage(success))
      .catch((reason: unknown) => setError(protectedActionError(reason, "Unable to check in")));
  }

  function checkIn() {
    setError("");
    setMessage("");
    if (!navigator.geolocation) {
      runCheckIn();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => runCheckIn(position.coords.latitude, position.coords.longitude),
      () => runCheckIn(undefined, undefined, "Checked in without location.")
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">CHECK-IN</p>
      <h2>Confirm you arrived</h2>
      <p>Location is optional. RSVP authority is always checked on the server.</p>
      <button type="button" onClick={checkIn}>Check in</button>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
