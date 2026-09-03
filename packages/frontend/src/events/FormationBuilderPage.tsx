import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useHoomaFrontend } from "../context";
import type { FormationRecord, FormationRosterPlayer, PublicEvent } from "./api";
import "./formation-builder-pitch.css";
import { useEventApi } from "./useEventApi";

type Format =
  | "FIVE_V_FIVE"
  | "SIX_V_SIX"
  | "SEVEN_V_SEVEN"
  | "EIGHT_V_EIGHT"
  | "NINE_V_NINE"
  | "TEN_V_TEN"
  | "ELEVEN_V_ELEVEN";
type Team = "A" | "B";
type SlotTemplate = {
  position: string;
  x: number;
  y: number;
};
type FormationPreset = {
  id: string;
  label: string;
  slots: SlotTemplate[];
};
type Slot = SlotTemplate & {
  id: string;
  team: Team;
  label: string;
  userId: string | null;
};

const FORMAT_OPTIONS: ReadonlyArray<{ value: Format; label: string }> = [
  { value: "FIVE_V_FIVE", label: "5 v 5" },
  { value: "SIX_V_SIX", label: "6 v 6" },
  { value: "SEVEN_V_SEVEN", label: "7 v 7" },
  { value: "EIGHT_V_EIGHT", label: "8 v 8" },
  { value: "NINE_V_NINE", label: "9 v 9" },
  { value: "TEN_V_TEN", label: "10 v 10" },
  { value: "ELEVEN_V_ELEVEN", label: "11 v 11" },
];

const markingLine = "rgba(247, 248, 241, 0.84)";

function spreadPositions(count: number): number[] {
  if (count === 1) return [50];
  const left = count >= 4 ? 15 : 20;
  const right = 100 - left;
  return Array.from({ length: count }, (_, index) => left + ((right - left) * index) / (count - 1));
}

function makeLine(y: number, positions: string[]): SlotTemplate[] {
  return positions.map((position, index) => ({
    position,
    x: spreadPositions(positions.length)[index] ?? 50,
    y,
  }));
}

function makePreset(
  id: string,
  label: string,
  lines: ReadonlyArray<{ y: number; positions: string[] }>,
): FormationPreset {
  return {
    id,
    label,
    slots: [
      { position: "GK", x: 50, y: 91 },
      ...lines.flatMap((line) => makeLine(line.y, line.positions)),
    ],
  };
}

function explicitPreset(id: string, label: string, slots: SlotTemplate[]): FormationPreset {
  return { id, label, slots };
}

const FORMATION_PRESETS: Record<Format, FormationPreset[]> = {
  FIVE_V_FIVE: [
    explicitPreset("classic-1-2-1", "Classic 1 - 2 - 1", [
      { position: "GK", x: 50, y: 88 },
      { position: "CB", x: 50, y: 66 },
      { position: "W", x: 24, y: 40 },
      { position: "W", x: 76, y: 40 },
      { position: "ST", x: 50, y: 15 },
    ]),
    makePreset("2-1-1", "2 - 1 - 1", [
      { y: 68, positions: ["CB", "CB"] },
      { y: 43, positions: ["CM"] },
      { y: 17, positions: ["ST"] },
    ]),
    makePreset("2-2", "2 - 2", [
      { y: 66, positions: ["CB", "CB"] },
      { y: 24, positions: ["W", "ST"] },
    ]),
  ],
  SIX_V_SIX: [
    makePreset("2-2-1", "2 - 2 - 1", [
      { y: 69, positions: ["CB", "CB"] },
      { y: 44, positions: ["CM", "CM"] },
      { y: 18, positions: ["ST"] },
    ]),
    makePreset("1-2-2", "1 - 2 - 2", [
      { y: 69, positions: ["CB"] },
      { y: 45, positions: ["CM", "CM"] },
      { y: 19, positions: ["W", "ST"] },
    ]),
    makePreset("2-1-2", "2 - 1 - 2", [
      { y: 69, positions: ["CB", "CB"] },
      { y: 45, positions: ["CM"] },
      { y: 19, positions: ["W", "ST"] },
    ]),
  ],
  SEVEN_V_SEVEN: [
    explicitPreset("classic-3-1-2", "Classic 3 - 1 - 2", [
      { position: "GK", x: 50, y: 90 },
      { position: "CB", x: 50, y: 70 },
      { position: "FB", x: 20, y: 60 },
      { position: "FB", x: 80, y: 60 },
      { position: "CM", x: 50, y: 42 },
      { position: "W", x: 25, y: 20 },
      { position: "W", x: 75, y: 20 },
    ]),
    makePreset("2-3-1", "2 - 3 - 1", [
      { y: 70, positions: ["CB", "CB"] },
      { y: 45, positions: ["W", "CM", "W"] },
      { y: 18, positions: ["ST"] },
    ]),
    makePreset("3-2-1", "3 - 2 - 1", [
      { y: 70, positions: ["FB", "CB", "FB"] },
      { y: 43, positions: ["CM", "CM"] },
      { y: 18, positions: ["ST"] },
    ]),
    makePreset("2-2-2", "2 - 2 - 2", [
      { y: 70, positions: ["CB", "CB"] },
      { y: 45, positions: ["CM", "CM"] },
      { y: 19, positions: ["W", "ST"] },
    ]),
  ],
  EIGHT_V_EIGHT: [
    makePreset("3-3-1", "3 - 3 - 1", [
      { y: 71, positions: ["FB", "CB", "FB"] },
      { y: 45, positions: ["CM", "DM", "CM"] },
      { y: 18, positions: ["ST"] },
    ]),
    makePreset("2-3-2", "2 - 3 - 2", [
      { y: 71, positions: ["CB", "CB"] },
      { y: 46, positions: ["W", "CM", "W"] },
      { y: 19, positions: ["ST", "ST"] },
    ]),
    makePreset("3-2-2", "3 - 2 - 2", [
      { y: 71, positions: ["FB", "CB", "FB"] },
      { y: 45, positions: ["CM", "CM"] },
      { y: 19, positions: ["W", "ST"] },
    ]),
  ],
  NINE_V_NINE: [
    makePreset("3-3-2", "3 - 3 - 2", [
      { y: 72, positions: ["FB", "CB", "FB"] },
      { y: 47, positions: ["CM", "DM", "CM"] },
      { y: 20, positions: ["ST", "ST"] },
    ]),
    makePreset("3-2-3", "3 - 2 - 3", [
      { y: 72, positions: ["FB", "CB", "FB"] },
      { y: 48, positions: ["CM", "CM"] },
      { y: 20, positions: ["W", "ST", "W"] },
    ]),
    makePreset("2-3-3", "2 - 3 - 3", [
      { y: 72, positions: ["CB", "CB"] },
      { y: 48, positions: ["CM", "DM", "CM"] },
      { y: 20, positions: ["W", "ST", "W"] },
    ]),
  ],
  TEN_V_TEN: [
    makePreset("3-4-2", "3 - 4 - 2", [
      { y: 73, positions: ["FB", "CB", "FB"] },
      { y: 49, positions: ["W", "CM", "CM", "W"] },
      { y: 21, positions: ["ST", "ST"] },
    ]),
    makePreset("4-3-2", "4 - 3 - 2", [
      { y: 73, positions: ["FB", "CB", "CB", "FB"] },
      { y: 48, positions: ["CM", "DM", "CM"] },
      { y: 21, positions: ["ST", "ST"] },
    ]),
    makePreset("3-3-3", "3 - 3 - 3", [
      { y: 73, positions: ["FB", "CB", "FB"] },
      { y: 48, positions: ["CM", "DM", "CM"] },
      { y: 21, positions: ["W", "ST", "W"] },
    ]),
  ],
  ELEVEN_V_ELEVEN: [
    explicitPreset("classic-4-1-2-3", "Classic 4 - 1 - 2 - 3", [
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
    ]),
    makePreset("4-3-3", "4 - 3 - 3", [
      { y: 74, positions: ["FB", "CB", "CB", "FB"] },
      { y: 49, positions: ["CM", "DM", "CM"] },
      { y: 21, positions: ["W", "ST", "W"] },
    ]),
    makePreset("4-4-2", "4 - 4 - 2", [
      { y: 74, positions: ["FB", "CB", "CB", "FB"] },
      { y: 49, positions: ["W", "CM", "CM", "W"] },
      { y: 21, positions: ["ST", "ST"] },
    ]),
    makePreset("4-2-3-1", "4 - 2 - 3 - 1", [
      { y: 76, positions: ["FB", "CB", "CB", "FB"] },
      { y: 58, positions: ["DM", "DM"] },
      { y: 37, positions: ["W", "AM", "W"] },
      { y: 17, positions: ["ST"] },
    ]),
    makePreset("3-5-2", "3 - 5 - 2", [
      { y: 74, positions: ["CB", "CB", "CB"] },
      { y: 49, positions: ["WB", "CM", "DM", "CM", "WB"] },
      { y: 21, positions: ["ST", "ST"] },
    ]),
  ],
};

function defaultFormation(format: Format): FormationPreset {
  const preset = FORMATION_PRESETS[format][0];
  if (!preset) throw new Error(`Missing formation preset for ${format}`);
  return preset;
}

function isFormat(value: string | null | undefined): value is Format {
  return FORMAT_OPTIONS.some((option) => option.value === value);
}

function makeSlots(format: Format, presetId = defaultFormation(format).id): Slot[] {
  const preset =
    FORMATION_PRESETS[format].find((candidate) => candidate.id === presetId) ??
    defaultFormation(format);
  return (["A", "B"] as const).flatMap((team) =>
    preset.slots.map((slot, index) => ({
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

function reshapeSlots(previous: Slot[], format: Format, presetId: string): Slot[] {
  const next = makeSlots(format, presetId);
  return next.map((slot) => ({
    ...slot,
    userId: previous.find((candidate) => candidate.id === slot.id)?.userId ?? null,
  }));
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
  return (
    FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format.replaceAll("_", " ")
  );
}

function PlayerPortrait({
  player,
  fallback,
}: {
  readonly player: FormationRosterPlayer | undefined;
  readonly fallback: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoUrl = player?.presentation?.photoUrl || null;
  if (photoUrl && failedUrl !== photoUrl) {
    return <img src={photoUrl} alt="" onError={() => setFailedUrl(photoUrl)} />;
  }
  return <>{player ? playerInitials(player) : fallback}</>;
}

function PitchMarkings() {
  const lineStyle = { "--formation-line": markingLine } as CSSProperties;
  return (
    <div className="formation-pitch__markings" aria-hidden="true" style={lineStyle}>
      <span className="formation-field-boundary" />
      <span className="formation-field-half" />
      <span className="formation-field-circle" />
      <span className="formation-field-center-dot" />
      <span className="formation-field-box formation-field-box--top" />
      <span className="formation-field-six formation-field-six--top" />
      <span className="formation-field-spot formation-field-spot--top" />
      <span className="formation-field-box formation-field-box--bottom" />
      <span className="formation-field-six formation-field-six--bottom" />
      <span className="formation-field-spot formation-field-spot--bottom" />
      <span className="formation-goal formation-goal--top" />
      <span className="formation-goal formation-goal--bottom" />
    </div>
  );
}

export function FormationBuilderPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [players, setPlayers] = useState<FormationRosterPlayer[]>([]);
  const [formations, setFormations] = useState<FormationRecord[]>([]);
  const [format, setFormat] = useState<Format>("SEVEN_V_SEVEN");
  const [formationId, setFormationId] = useState(() => defaultFormation("SEVEN_V_SEVEN").id);
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
        if (isFormat(eventFormat)) {
          const initialFormation = defaultFormation(eventFormat);
          setFormat(eventFormat);
          setFormationId(initialFormation.id);
          setSlots(makeSlots(eventFormat, initialFormation.id));
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
  const benchPlayers = useMemo(
    () => players.filter((player) => !assigned.has(player.userId)),
    [assigned, players],
  );

  function changeFormat(next: Format) {
    const nextFormation = defaultFormation(next);
    setFormat(next);
    setFormationId(nextFormation.id);
    setSlots(makeSlots(next, nextFormation.id));
    setSuccess("");
  }

  function changeFormation(nextFormationId: string) {
    setFormationId(nextFormationId);
    setSlots((previous) => reshapeSlots(previous, format, nextFormationId));
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

  function openSlotPicker(slotId: string) {
    const select = selectRefs.current[slotId];
    if (!select) return;
    const picker = select as HTMLSelectElement & { showPicker?: () => void };
    try {
      if (picker.showPicker) {
        picker.showPicker();
      } else {
        select.focus();
        select.click();
      }
    } catch {
      select.focus();
    }
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

      <div className="formation-toolbar panel formation-toolbar--builder">
        <label>
          Formation name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <div className="formation-builder__selectors">
          <label>
            Match size
            <select value={format} onChange={(event) => changeFormat(event.target.value as Format)}>
              {FORMAT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Formation
            <select value={formationId} onChange={(event) => changeFormation(event.target.value)}>
              {FORMATION_PRESETS[format].map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="formation-publish">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
          />{" "}
          Publish to participants
        </label>
      </div>

      <div className="formation-pitches">
        {(["A", "B"] as const).map((team) => {
          const accent = team === "A" ? "#31f56f" : "#f2c94c";
          const teamStyle = { "--formation-accent": accent } as CSSProperties;
          return (
            <section key={team} className="formation-team formation-team--game" style={teamStyle}>
              <div className="formation-team__heading">
                <h2>Team {team}</h2>
                <span>
                  {FORMATION_PRESETS[format].find((preset) => preset.id === formationId)?.label}
                </span>
                <small>{formatLabel(format)}</small>
              </div>

              <div className="formation-pitch formation-pitch--stadium">
                <div className="formation-pitch__lights" aria-hidden="true" />
                <div className="formation-pitch__surface">
                  <PitchMarkings />
                </div>
                <div className="formation-pitch__players">
                  {slots
                    .filter((slot) => slot.team === team)
                    .map((slot) => {
                      const player = slot.userId ? byId.get(slot.userId) : undefined;
                      return (
                        <div
                          className="formation-slot formation-slot--game"
                          data-assigned={Boolean(player)}
                          key={slot.id}
                          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        >
                          <button
                            className="formation-slot__tap-target"
                            type="button"
                            onClick={() => openSlotPicker(slot.id)}
                            aria-label={`Change Team ${team} ${slot.position}`}
                          >
                            <span className="formation-slot__marker formation-slot__marker--game">
                              <PlayerPortrait player={player} fallback={slot.label} />
                              <span className="formation-slot__position">{slot.position}</span>
                            </span>
                            <span className="formation-slot__name">
                              {player ? playerName(player) : slot.position}
                            </span>
                          </button>
                          <select
                            ref={(node) => {
                              selectRefs.current[slot.id] = node;
                            }}
                            aria-label={`Team ${team} ${slot.position}`}
                            value={slot.userId || ""}
                            onChange={(event) => assign(slot.id, event.target.value)}
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
                        </div>
                      );
                    })}
                </div>
              </div>

              <section
                className="formation-bench"
                aria-label={`Unassigned players available below Team ${team}`}
              >
                <div className="formation-bench__header">
                  <strong>⚽ Bench</strong>
                  <span>{benchPlayers.length} available</span>
                </div>
                <div className="formation-bench__players">
                  {benchPlayers.map((player) => (
                    <button
                      type="button"
                      className="formation-bench-player"
                      key={`${team}-${player.userId}`}
                      title={`${playerName(player)} is currently unassigned`}
                    >
                      <span className="formation-bench-player__portrait">
                        <PlayerPortrait player={player} fallback={playerInitials(player)} />
                      </span>
                      <span>{playerName(player)}</span>
                    </button>
                  ))}
                  {!benchPlayers.length ? <p className="muted">No bench players</p> : null}
                </div>
                <p className="formation-bench__hint">
                  Tap a player on the pitch to change the assignment. Bench players are unassigned.
                </p>
              </section>
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
