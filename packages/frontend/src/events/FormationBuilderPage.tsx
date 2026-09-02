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

const markingLine = "rgba(247, 248, 241, 0.82)";

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

function shapeLabel(format: Format): string {
  if (format === "FIVE_V_FIVE") return "1 - 2 - 1";
  if (format === "SEVEN_V_SEVEN") return "3 - 1 - 2";
  return "4 - 3 - 3";
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
          inset: "4.5% 5%",
          border: `1px solid ${markingLine}`,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "5%",
          right: "5%",
          top: "50%",
          height: "1px",
          background: markingLine,
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "50%",
          top: "50%",
          width: "24%",
          aspectRatio: "1",
          transform: "translate(-50%, -50%)",
          border: `1px solid ${markingLine}`,
          borderRadius: "50%",
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
          ...absoluteLine,
          left: "25%",
          top: "4.5%",
          width: "50%",
          height: "15%",
          border: `1px solid ${markingLine}`,
          borderTop: 0,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "38%",
          top: "4.5%",
          width: "24%",
          height: "7%",
          border: `1px solid ${markingLine}`,
          borderTop: 0,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "25%",
          bottom: "4.5%",
          width: "50%",
          height: "15%",
          border: `1px solid ${markingLine}`,
          borderBottom: 0,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          ...absoluteLine,
          left: "38%",
          bottom: "4.5%",
          width: "24%",
          height: "7%",
          border: `1px solid ${markingLine}`,
          borderBottom: 0,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "14%",
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
          bottom: "14%",
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
          left: "42%",
          top: "1.5%",
          width: "16%",
          height: "3.2%",
          border: `1px solid ${markingLine}`,
          borderBottom: 0,
          borderRadius: "4px 4px 0 0",
          boxShadow: "0 -5px 12px rgba(255, 255, 255, 0.12)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "42%",
          bottom: "1.5%",
          width: "16%",
          height: "3.2%",
          border: `1px solid ${markingLine}`,
          borderTop: 0,
          borderRadius: "0 0 4px 4px",
          boxShadow: "0 5px 12px rgba(255, 255, 255, 0.12)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function PlayerPortrait({
  player,
  fallback,
}: {
  readonly player?: FormationRosterPlayer;
  readonly fallback: string;
}) {
  const photoUrl = player?.presentation?.photoUrl || null;
  if (photoUrl) {
    return (
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
    );
  }
  return <>{player ? playerInitials(player) : fallback}</>;
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
  const [activeTeam, setActiveTeam] = useState<Team>("A");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

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
  const activeSlots = useMemo(
    () => slots.filter((slot) => slot.team === activeTeam),
    [activeTeam, slots],
  );
  const benchPlayers = useMemo(
    () => players.filter((player) => !assigned.has(player.userId)),
    [assigned, players],
  );
  const editingSlot = useMemo(
    () => slots.find((slot) => slot.id === editingSlotId) || null,
    [editingSlotId, slots],
  );

  function changeFormat(next: Format) {
    setFormat(next);
    setSlots(makeSlots(next));
    setEditingSlotId(null);
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
    setEditingSlotId(null);
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

  const accent = activeTeam === "A" ? "#31f56f" : "#f2c94c";

  return (
    <section
      className="formation-builder"
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        gap: "14px",
        paddingBottom: "24px",
      }}
    >
      <header
        className="formation-builder__header"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: "12px",
          minHeight: "58px",
          padding: "0 2px",
        }}
      >
        <a
          href={`/events/${eventId}`}
          aria-label="Back to match"
          style={{
            width: "42px",
            height: "42px",
            display: "grid",
            placeItems: "center",
            padding: 0,
            border: 0,
            color: "#fff",
            fontSize: "34px",
            lineHeight: 1,
          }}
        >
          ‹
        </a>
        <div
          style={{
            minWidth: 0,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(24px, 6vw, 34px)",
              lineHeight: 1,
            }}
          >
            Formation Builder
          </h1>
          <p
            style={{
              margin: "5px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "12px",
            }}
          >
            {event?.title || "Pickup match"}
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void save()}
          style={{
            border: 0,
            background: "transparent",
            color: "#31f56f",
            font: "inherit",
            fontSize: "17px",
            fontWeight: 850,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div
        className="formation-format-picker"
        aria-label="Match format"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "6px",
          padding: "5px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "12px",
          background: "#111210",
        }}
      >
        {(["FIVE_V_FIVE", "SEVEN_V_SEVEN", "ELEVEN_V_ELEVEN"] as const).map((candidate) => (
          <button
            type="button"
            key={candidate}
            aria-pressed={format === candidate}
            onClick={() => changeFormat(candidate)}
            style={{
              minHeight: "48px",
              border: format === candidate ? "1px solid #31f56f" : "1px solid transparent",
              borderRadius: "9px",
              background: format === candidate ? "#31f56f" : "transparent",
              color: format === candidate ? "#061109" : "rgba(255, 255, 255, 0.72)",
              fontSize: "16px",
              fontWeight: 800,
            }}
          >
            {formatLabel(candidate)}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "2px 3px",
        }}
      >
        <strong
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#fff",
            fontSize: "17px",
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ color: accent }}>▦</span>
          {shapeLabel(format)}
        </strong>
        <div
          role="group"
          aria-label="Team"
          style={{
            display: "inline-flex",
            gap: "4px",
            padding: "4px",
            border: "1px solid rgba(255, 255, 255, 0.09)",
            borderRadius: "999px",
            background: "rgba(255, 255, 255, 0.035)",
          }}
        >
          {(["A", "B"] as const).map((team) => {
            const selected = activeTeam === team;
            return (
              <button
                key={team}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActiveTeam(team);
                  setEditingSlotId(null);
                }}
                style={{
                  minWidth: "72px",
                  minHeight: "34px",
                  border: 0,
                  borderRadius: "999px",
                  background: selected ? "rgba(49, 245, 111, 0.12)" : "transparent",
                  color: selected ? "#31f56f" : "rgba(255, 255, 255, 0.62)",
                  font: "inherit",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                Team {team}
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="formation-team"
        style={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(216, 180, 97, 0.24)",
          borderRadius: "22px",
          background:
            "radial-gradient(ellipse at 50% 1%, rgba(255, 255, 255, 0.15), transparent 22%), radial-gradient(ellipse at 50% 9%, rgba(49, 245, 111, 0.1), transparent 32%), linear-gradient(180deg, #111613 0 8%, #080a09 22%, #030403 100%)",
          boxShadow: "0 24px 54px rgba(0, 0, 0, 0.42)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            height: "54px",
            background:
              "radial-gradient(circle at 12% 65%, rgba(255, 255, 255, 0.22) 0 1px, transparent 2px), radial-gradient(circle at 28% 40%, rgba(255, 255, 255, 0.16) 0 1px, transparent 2px), radial-gradient(circle at 72% 42%, rgba(255, 255, 255, 0.18) 0 1px, transparent 2px), radial-gradient(circle at 88% 66%, rgba(255, 255, 255, 0.22) 0 1px, transparent 2px), linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent)",
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "relative",
            margin: "-12px 10px 0",
            filter: "drop-shadow(0 18px 24px rgba(0, 0, 0, 0.38))",
          }}
        >
          <div
            className="formation-pitch"
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "0.72",
              overflow: "hidden",
              border: `1px solid ${accent}73`,
              borderRadius: "14px 14px 8px 8px",
              clipPath: "polygon(12% 0, 88% 0, 100% 100%, 0 100%)",
              background:
                "radial-gradient(ellipse at 50% 12%, rgba(255, 255, 255, 0.15), transparent 26%), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 8.5%, rgba(0, 0, 0, 0.055) 8.5% 17%), linear-gradient(180deg, #215f34 0%, #184e2c 43%, #103922 100%)",
              boxShadow:
                "inset 0 0 56px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.13)",
            }}
          >
            <PitchMarkings />
            {activeSlots.map((slot) => {
              const player = slot.userId ? byId.get(slot.userId) : undefined;
              const selected = editingSlotId === slot.id;
              return (
                <button
                  type="button"
                  className="formation-slot"
                  key={slot.id}
                  aria-label={`${player ? playerName(player) : slot.position}. Tap to change Team ${activeTeam} ${slot.position}`}
                  aria-pressed={selected}
                  onClick={() =>
                    setEditingSlotId((current) => (current === slot.id ? null : slot.id))
                  }
                  style={{
                    position: "absolute",
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: "82px",
                    display: "grid",
                    justifyItems: "center",
                    gap: "4px",
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "#fff",
                    font: "inherit",
                    cursor: "pointer",
                    zIndex: selected ? 4 : 2,
                  }}
                >
                  <span
                    style={{
                      width: "48px",
                      height: "48px",
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                      overflow: "visible",
                      border: `2px solid ${accent}`,
                      borderRadius: "50%",
                      background: "#07100b",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 900,
                      boxShadow: selected
                        ? `0 0 0 5px ${accent}38, 0 8px 18px rgba(0, 0, 0, 0.55)`
                        : `0 0 0 3px ${accent}1c, 0 7px 16px rgba(0, 0, 0, 0.48)`,
                    }}
                  >
                    <PlayerPortrait player={player} fallback={slot.position} />
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
                        lineHeight: 1.1,
                      }}
                    >
                      {slot.position}
                    </span>
                  </span>
                  <span
                    style={{
                      maxWidth: "82px",
                      overflow: "hidden",
                      padding: "3px 7px",
                      borderRadius: "999px",
                      background: "rgba(2, 6, 4, 0.82)",
                      color: player ? "#fff" : "rgba(255, 255, 255, 0.7)",
                      fontSize: "9px",
                      fontWeight: 800,
                      lineHeight: 1.1,
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      boxShadow: "0 3px 9px rgba(0, 0, 0, 0.34)",
                    }}
                  >
                    {player ? playerName(player) : slot.position}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "14px 12px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, rgba(3, 5, 4, 0.92), #020302)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              color: "rgba(255, 255, 255, 0.76)",
              fontSize: "12px",
            }}
          >
            <strong style={{ color: "#fff" }}>⚽ Bench</strong>
            <span>{benchPlayers.length} available</span>
          </div>
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "64px",
              gap: "10px",
              overflowX: "auto",
              paddingBottom: "3px",
            }}
          >
            {benchPlayers.map((player) => (
              <div
                key={player.userId}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    width: "46px",
                    height: "46px",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    border: "2px solid #31f56f",
                    borderRadius: "50%",
                    background: "#07100b",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 900,
                    boxShadow: "0 5px 14px rgba(0, 0, 0, 0.38)",
                  }}
                >
                  <PlayerPortrait player={player} fallback={playerInitials(player)} />
                </span>
                <span
                  style={{
                    width: "64px",
                    overflow: "hidden",
                    color: "rgba(255, 255, 255, 0.86)",
                    fontSize: "9px",
                    textAlign: "center",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {playerName(player)}
                </span>
              </div>
            ))}
            {!benchPlayers.length ? (
              <span
                style={{
                  color: "rgba(255, 255, 255, 0.52)",
                  fontSize: "11px",
                }}
              >
                No bench players
              </span>
            ) : null}
          </div>
          <p
            style={{
              margin: 0,
              color: "rgba(255, 255, 255, 0.52)",
              fontSize: "11px",
            }}
          >
            Tap a player on the pitch to change the assignment.
          </p>
        </div>
      </section>

      {editingSlot ? (
        <section
          aria-label={`Choose player for ${editingSlot.position}`}
          style={{
            display: "grid",
            gap: "10px",
            padding: "13px",
            border: `1px solid ${accent}66`,
            borderRadius: "18px",
            background: "linear-gradient(145deg, #0b100d, #050706)",
            boxShadow: "0 18px 36px rgba(0, 0, 0, 0.32)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong style={{ color: "#fff" }}>
              Team {editingSlot.team} · {editingSlot.position}
            </strong>
            <button
              type="button"
              onClick={() => setEditingSlotId(null)}
              style={{
                border: 0,
                background: "transparent",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Close
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => assign(editingSlot.id, "")}
              style={{
                minHeight: "46px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.035)",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Empty position
            </button>
            {players.map((candidate) => {
              const inThisSlot = candidate.userId === editingSlot.userId;
              const unavailable = assigned.has(candidate.userId) && !inThisSlot;
              return (
                <button
                  type="button"
                  key={candidate.userId}
                  disabled={unavailable}
                  onClick={() => assign(editingSlot.id, candidate.userId)}
                  style={{
                    minHeight: "46px",
                    display: "grid",
                    gridTemplateColumns: "30px minmax(0, 1fr)",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 9px",
                    border: inThisSlot
                      ? `1px solid ${accent}`
                      : "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "12px",
                    background: inThisSlot ? `${accent}18` : "rgba(255, 255, 255, 0.035)",
                    color: unavailable ? "rgba(255, 255, 255, 0.28)" : "#fff",
                    textAlign: "left",
                    opacity: unavailable ? 0.55 : 1,
                  }}
                >
                  <span
                    style={{
                      width: "30px",
                      height: "30px",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                      border: `1px solid ${accent}`,
                      borderRadius: "50%",
                      background: "#07100b",
                      fontSize: "8px",
                      fontWeight: 900,
                    }}
                  >
                    <PlayerPortrait player={candidate} fallback={playerInitials(candidate)} />
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {playerName(candidate)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <details
        style={{
          border: "1px solid rgba(216, 180, 97, 0.22)",
          borderRadius: "14px",
          background: "#0a0b09",
        }}
      >
        <summary
          style={{
            padding: "11px 13px",
            color: "rgba(255, 255, 255, 0.78)",
            fontSize: "12px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Formation settings
        </summary>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: "10px",
            padding: "0 12px 12px",
          }}
        >
          <label
            style={{
              display: "grid",
              gap: "5px",
              color: "rgba(255, 255, 255, 0.64)",
              fontSize: "11px",
            }}
          >
            Formation name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              style={{
                minWidth: 0,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "10px",
                background: "#080a08",
                color: "#fff",
                padding: "10px 11px",
              }}
            />
          </label>
          <label
            style={{
              alignSelf: "end",
              minHeight: "42px",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "rgba(255, 255, 255, 0.72)",
              fontSize: "12px",
              whiteSpace: "nowrap",
            }}
          >
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Publish
          </label>
        </div>
      </details>

      {success ? <p className="success">{success}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {formations.length ? (
        <section className="formation-history" style={{ marginTop: "4px" }}>
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
