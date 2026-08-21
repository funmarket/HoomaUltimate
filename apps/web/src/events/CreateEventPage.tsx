import { FormEvent, useEffect, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { webApi } from "../api/client";
import { eventApi } from "../api/event-client";

export function CreateEventPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void webApi.me().then(setMe).catch((reason: Error) => setError(reason.message)); }, []);
  const communities = me?.communities.filter((membership) => membership.role === "FOUNDER" || membership.role === "COACH") ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startsAt = new Date(String(data.get("startsAt")));
    const endsValue = String(data.get("endsAt") || "");
    const endsAt = endsValue ? new Date(endsValue) : null;
    setError("");
    void eventApi.create({
      communityId: String(data.get("communityId")),
      type: "PLAY",
      title: String(data.get("title")),
      description: String(data.get("description")) || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Tunis",
      venueName: String(data.get("venueName")) || null,
      address: String(data.get("address")) || null,
      capacity: data.get("capacity") ? Number(data.get("capacity")) : null,
      waitlistEnabled: true,
      entryFeeMinor: 0,
      currency: "TND",
      play: {
        pitchType: String(data.get("pitchType")) as "FIVE_A_SIDE",
        skillLevel: String(data.get("skillLevel")) as "MIXED",
        format: String(data.get("format")) as "FIVE_V_FIVE"
      }
    }).then((created) => { window.location.href = `/events/${created.id}`; }).catch((reason: Error) => setError(reason.message));
  }

  if (error && !me) return <section className="panel"><p className="error">{error}</p><a href="/login?returnTo=%2Fevents%2Fnew">Sign in</a></section>;
  return <section><p className="eyebrow">PLAY</p><h2>Create a game</h2>{!communities.length ? <p className="status">You need Founder or Coach authority in a HOOMA community to create a community game.</p> : <form className="event-form panel" onSubmit={submit}><label>HOOMA community<select name="communityId" required>{communities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label><label>Game title<input name="title" required /></label><label>Description<textarea name="description" rows={4} /></label><div className="form-grid"><label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" /></label></div><div className="form-grid"><label>Capacity<input name="capacity" type="number" min="1" max="1000" /></label><label>Format<select name="format" defaultValue="FIVE_V_FIVE"><option value="FIVE_V_FIVE">5 v 5</option><option value="SEVEN_V_SEVEN">7 v 7</option><option value="ELEVEN_V_ELEVEN">11 v 11</option></select></label></div><div className="form-grid"><label>Pitch type<select name="pitchType" defaultValue="FIVE_A_SIDE"><option value="FIVE_A_SIDE">5-a-side</option><option value="SEVEN_A_SIDE">7-a-side</option><option value="ELEVEN_A_SIDE">11-a-side</option><option value="FUTSAL">Futsal</option><option value="STREET">Street</option><option value="OTHER">Other</option></select></label><label>Skill level<select name="skillLevel" defaultValue="MIXED"><option value="MIXED">Mixed</option><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label></div><label>Venue<input name="venueName" /></label><label>Address<input name="address" /></label><p className="muted">Paid game entry is intentionally disabled until Cash and Telegram Stars are wired into the new Payments domain.</p><button type="submit">Publish game</button>{error ? <p className="error">{error}</p> : null}</form>}</section>;
}
