import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useHoomaFrontend } from "../context";
import type { FormationRecord, FormationRosterPlayer, PublicEvent } from "./api";
import { useEventApi } from "./useEventApi";

type Format = "FIVE_V_FIVE" | "SEVEN_V_SEVEN" | "ELEVEN_V_ELEVEN";
type Team = "A" | "B";
type Slot = {
  id: string;
  team: Team;
  position: string;
  label: string;
  x: number;
  y: number;
  userId: string | null;
};

const FORMATIONS: Record<Format, Array<{ position: string; x: number; y: number }>> = {
  FIVE_V_FIVE: [
    { position: "GK", x: 50, y: 88 },
    { position: "CB", x: 50, y: 66 },
    { position: "W", x: 24, y: 40 },
    { position: "W", x: 76, y: 40 },
    { position: "ST", x: 50, y: 15 },
  ],
  SEVEN_V_SEVEN: [
    { position: "GK", x: 50, y: 90 },
    { position: "CB", x: 50, y: 70 },
    { position: "FB", x: 20, y: 60 },
    { position: "FB", x: 80, y: 60 },
    { position: "CM", x: 50, y: 42 },
    { position: "W", x: 25, y: 20 },
    { position: "W", x: 75, y: 20 },
  ],
  ELEVEN_V_ELEVEN: [
    { position: "GK", x: 50, y: 92 },
    { position: "FB", x: 14, y: 72 },
    { position: "CB", x: 38, y: 78 },
    { position: "CB", x: 62, y: 78 },
    { position: "FB", x: 86, y: 72 },
    { position: "DM", x: 50, y: 58 },
    { position: "CM", x: 30, y: 43 },
    { position: "CM", x: 70, y: 43 },
    { position: "W", x: 18, y: 20 },
    { position: "ST", x: 50, y: 12 },
    { position: "W", x: 82, y: 20 },
  ],
};

const markingLine = "rgba(247, 248, 241, 0.74)";

function makeSlots(format: Format): Slot[] {
  return (["A", "B"] as const).flatMap((team) =>
    FORMATIONS[format].map((slot, index) => ({
      id: `${team}-${index}`,
      team,
      position: slot.position,
      label: slot.position,
      x: slot.x,
      y: slot.y,
      userId: null,
    })),
  );
}

function playerName(player: FormationRosterPlayer): string {
  return player.presentation?.displayName || player.presentation?.username || "HOOMA player";
}

function playerInitials(player: FormationRosterPlayer): string {
  return playerName(player)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatLabel(format: Format): string {
  if (format === "FIVE_V_FIVE") return "5 v 5";
  if (format === "SEVEN_V_SEVEN") return "7 v 7";
  return "11 v 11";
}

function PitchMarkings() {
  const absoluteLine: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    borderColor: markingLine,
    boxSizing: "border-box",
  };

  return (
    <>
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "27%",
          top: "5%",
          width: "46%",
          height: "14%",
          borderStyle: "solid",
          borderWidth: "0 1px 1px",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "38%",
          top: "5%",
          width: "24%",
          height: "6%",
          borderStyle: "solid",
          borderWidth: "0 1px 1px",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "27%",
          bottom: "5%",
          width: "46%",
          height: "14%",
          borderStyle: "solid",
          borderWidth: "1px 1px 0",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "38%",
          bottom: "5%",
          width: "24%",
          height: "6%",
          borderStyle: "solid",
          borderWidth: "1px 1px 0",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "13.5%",
          width: "4px",
          height: "4px",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: markingLine,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "13.5%",
          width: "4px",
          height: "4px",
          transform: "translate(-50%, 50%)",
          borderRadius: "50%",
          background: markingLine,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "5px",
          height: "5px",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: markingLine,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "42%",
          top: "2.1%",
          width: "16%",
          height: "3.2%",
          border: `1px solid ${markingLine}`,
          borderBottom: 0,
          borderRadius: "4px 4px 0 0",
          boxShadow: "0 -5px 12px rgba(255, 255, 255, 0.08)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "42%",
          bottom: "2.1%",
          width: "16%",
          height: "3.2%",
          border: `1px solid ${markingLine}`,
          borderTop: 0,
          borderRadius: "0 0 4px 4px",
          boxShadow: "0 5px 12px rgba(255, 255, 255, 0.08)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "4.5%",
          top: "4.5%",
          width: "17px",
          height: "17px",
          borderTop: `1px solid ${markingLine}`,
          borderLeft: `1px solid ${markingLine}`,
          borderRadius: "17px 0 0",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "4.5%",
          top: "4.5%",
          width: "17px",
          height: "17px",
          borderTop: `1px solid ${markingLine}`,
          borderRight: `1px solid ${markingLine}`,
          borderRadius: "0 17px 0 0",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "4.5%",
          bottom: "4.5%",
          width: "17px",
          height: "17px",
          borderBottom: `1px solid ${markingLine}`,
          borderLeft: `1px solid ${markingLine}`,
          borderRadius: "0 0 0 17px",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "4.5%",
          bottom: "4.5%",
          width: "17px",
          height: "17px",
          borderBottom: `1px solid ${markingLine}`,
          borderRight: `1px solid ${markingLine}`,
          borderRadius: "0 0 17px",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

export function FormationBuilderPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [players, setPlayers] = useState<FormationRosterPlayer[]>([]);
  const [formations, setFormations] = useState<FormationRecord[]>([]);
  const [format, setFormat] = useState<Format>("SEVEN_V_SEVEN");
  const [slots, setSlots] = useState<Slot[]>(() => makeSlots("SEVEN_V_SEVEN"));
  const [name, setName] = useState("Matchday formation");
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        const [eventResult, rosterResult, formationResult] = await Promise.all([
          eventApi.publicDetail(eventId),
          eventApi.formationRoster(eventId),
          eventApi.formations(eventId),
        ]);
        if (!active) return;
        setEvent(eventResult);
        setPlayers(rosterResult.players);
        setFormations(formationResult);
        const eventFormat = eventResult.playDetails?.format;
        if (
          eventFormat === "FIVE_V_FIVE" ||
          eventFormat === "SEVEN_V_SEVEN" ||
          eventFormat === "ELEVEN_V_ELEVEN"
        ) {
          setFormat(eventFormat);
          setSlots(makeSlots(eventFormat));
        }
      } catch (reason) {
        if (active) setError(protectedError(reason, "Unable to load formation builder"));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventApi, eventId, protectedError]);

  const assigned = useMemo(
    () => new Set(slots.map((slot) => slot.userId).filter((id): id is string => Boolean(id))),
    [slots],
  );
  const byId = useMemo(() => new Map(players.map((player) => [player.userId, player])), [players]);

  function changeFormat(next: Format) {
    setFormat(next);
    setSlots(makeSlots(next));
    setSuccess("");
  }

  function assign(slotId: string, userId: string) {
    setSlots((previous) =>
      previous.map((slot) => {
        if (slot.id === slotId) return { ...slot, userId: userId || null };
        if (userId && slot.userId === userId) return { ...slot, userId: null };
        return slot;
      }),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await eventApi.createFormation(eventId, {
        name: name.trim(),
        format,
        published,
        slots: slots.map(({ team, position, label, x, y, userId }) => ({
          team,
          position,
          label,
          x,
          y,
          userId,
        })),
      });
      setFormations(await eventApi.formations(eventId));
      setSuccess("Formation saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save formation"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="formation-builder">
      <header className="formation-builder__header">
        <div>
          <p className="eyebrow">Tactical board</p>
          <h1>Formation builder</h1>
          <p>{event?.title || "Pickup match"}</p>
        </div>
        <a href={`/events/${eventId}`}>Back to match</a>
      </header>

      <div className="formation-toolbar panel">
        <label>
          Formation name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <div className="formation-format-picker" aria-label="Match format">
          {(["FIVE_V_FIVE", "SEVEN_V_SEVEN", "ELEVEN_V_ELEVEN"] as const).map((candidate) => (
            <button
              type="button"
              key={candidate}
              aria-pressed={format === candidate}
              onClick={() => changeFormat(candidate)}
            >
              {candidate === "FIVE_V_FIVE"
                ? "5v5"
                : candidate === "SEVEN_V_SEVEN"
                  ? "7v7"
                  : "11v11"}
            </button>
          ))}
        </div>
        <label className="formation-publish">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />{" "}
          Publish to participants
        </label>
      </div>

      <div className="formation-pitches">
        {(["A", "B"] as const).map((team) => {
          const accent = team === "A" ? "#31f56f" : "#f2c94c";
          return (
            <section key={team} className="formation-team">
              <h2
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span>Team {team}</span>
                <span style={{ color: accent, fontSize: "11px" }}>{formatLabel(format)}</span>
              </h2>
              <div
                className="formation-pitch"
                style={{
                  borderColor: `${accent}66`,
                  background:
                    "radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.11), transparent 34%), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 9.5%, rgba(0, 0, 0, 0.05) 9.5% 19%), linear-gradient(180deg, #1c623a 0%, #154c30 46%, #113d28 100%)",
                  boxShadow:
                    "inset 0 0 52px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 50px rgba(0, 0, 0, 0.32)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(ellipse at 50% -8%, rgba(255, 255, 255, 0.16), transparent 32%), radial-gradient(ellipse at 50% 108%, rgba(49, 245, 111, 0.08), transparent 34%), linear-gradient(90deg, rgba(0, 0, 0, 0.18), transparent 16%, transparent 84%, rgba(0, 0, 0, 0.18))",
                    pointerEvents: "none",
                  }}
                />
                <span className="formation-pitch__half" aria-hidden="true" />
                <span className="formation-pitch__circle" aria-hidden="true" />
                <PitchMarkings />
                {slots
                  .filter((slot) => slot.team === team)
                  .map((slot) => {
                    const player = slot.userId ? byId.get(slot.userId) : undefined;
                    const photoUrl = player?.presentation?.photoUrl || null;
                    return (
                      <label
                        className="formation-slot"
                        key={slot.id}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      >
                        <span
                          className="formation-slot__marker"
                          style={{
                            width: "44px",
                            height: "44px",
                            position: "relative",
                            overflow: "visible",
                            borderColor: accent,
                            background: "rgba(5, 12, 8, 0.94)",
                            boxShadow: `0 0 0 4px ${accent}1f, 0 8px 18px rgba(0, 0, 0, 0.48)`,
                          }}
                        >
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                borderRadius: "50%",
                              }}
                            />
                          ) : player ? (
                            playerInitials(player)
                          ) : (
                            slot.label
                          )}
                          <span
                            style={{
                              position: "absolute",
                              right: "-8px",
                              bottom: "-5px",
                              minWidth: "22px",
                              padding: "2px 5px",
                              border: `1px solid ${accent}`,
                              borderRadius: "999px",
                              background: "#07100b",
                              color: accent,
                              fontSize: "8px",
                              fontWeight: 950,
                              lineHeight: 1.15,
                              textAlign: "center",
                            }}
                          >
                            {slot.position}
                          </span>
                        </span>
                        <span
                          style={{
                            maxWidth: "84px",
                            overflow: "hidden",
                            padding: "2px 6px",
                            borderRadius: "999px",
                            background: "rgba(2, 6, 4, 0.74)",
                            color: player ? "#fff" : "rgba(255, 255, 255, 0.7)",
                            fontSize: "9px",
                            fontWeight: 800,
                            lineHeight: 1.2,
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            boxShadow: "0 3px 8px rgba(0, 0, 0, 0.32)",
                          }}
                        >
                          {player ? playerName(player) : slot.position}
                        </span>
                        <select
                          aria-label={`Team ${team} ${slot.position}`}
                          value={slot.userId || ""}
                          onChange={(e) => assign(slot.id, e.target.value)}
                          style={{
                            borderColor: `${accent}73`,
                            background: "rgba(4, 9, 6, 0.93)",
                            color: "#fff",
                          }}
                        >
                          <option value="">{slot.position}</option>
                          {players.map((candidate) => (
                            <option
                              value={candidate.userId}
                              key={candidate.userId}
                              disabled={
                                assigned.has(candidate.userId) && candidate.userId !== slot.userId
                              }
                            >
                              {playerName(candidate)}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="formation-roster panel">
        <div>
          <p className="eyebrow">Confirmed roster</p>
          <h2>Available players</h2>
        </div>
        <div className="formation-roster__list">
          {players.map((player) => (
            <span key={player.userId} data-assigned={assigned.has(player.userId)}>
              {playerName(player)}
              {player.status === "ATTENDED" ? " · checked in" : ""}
            </span>
          ))}
          {!players.length ? <p className="muted">No confirmed players yet.</p> : null}
        </div>
      </section>

      <button
        className="formation-save"
        type="button"
        disabled={saving || !name.trim()}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save formation"}
      </button>
      {success ? <p className="success">{success}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {formations.length ? (
        <section className="formation-history">
          <p className="eyebrow">Saved formations</p>
          {formations.map((formation) => (
            <article className="panel" key={formation.id}>
              <strong>{formation.name}</strong>
              <span>
                {formation.format.replaceAll("_", " ")} ·{" "}
                {formation.slots.filter((slot) => slot.userId).length} assigned ·{" "}
                {formation.published ? "Published" : "Draft"}
              </span>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
