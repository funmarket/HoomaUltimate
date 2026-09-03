import { useEffect, useMemo, useState } from "react";
import {
  FOOTBALL_FORMAT_PLAYER_COUNTS,
  TEAM_POSITION_ROLES,
  type TeamLineupInput,
} from "@hooma/contracts";
import type { TeamControlDetail, TeamLineupView, TeamRosterPlayer } from "../api";
import { TeamLineupPitch } from "./TeamLineupPitch";
import "./TeamLineupPitch.css";

type FootballFormat = TeamLineupInput["matchFormat"];
type PositionRole = TeamLineupInput["slots"][number]["position"];

type DraftSlot = {
  teamPlayerId: string | null;
  position: PositionRole;
  x: number;
  y: number;
  isStarter: boolean;
  sortOrder: number;
};

const MATCH_FORMATS: Array<{ value: FootballFormat; label: string }> = [
  { value: "FIVE_V_FIVE", label: "5v5" },
  { value: "SIX_V_SIX", label: "6v6" },
  { value: "SEVEN_V_SEVEN", label: "7v7" },
  { value: "EIGHT_V_EIGHT", label: "8v8" },
  { value: "NINE_V_NINE", label: "9v9" },
  { value: "TEN_V_TEN", label: "10v10" },
  { value: "ELEVEN_V_ELEVEN", label: "11v11" },
];

const FORMATIONS: Record<FootballFormat, string[]> = {
  FIVE_V_FIVE: ["1-2-1", "2-1-1", "2-2", "CUSTOM"],
  SIX_V_SIX: ["2-2-1", "1-3-1", "2-1-2", "CUSTOM"],
  SEVEN_V_SEVEN: ["2-3-1", "3-2-1", "2-2-2", "CUSTOM"],
  EIGHT_V_EIGHT: ["3-3-1", "2-3-2", "3-2-2", "CUSTOM"],
  NINE_V_NINE: ["3-3-2", "4-3-1", "3-4-1", "CUSTOM"],
  TEN_V_TEN: ["3-4-2", "4-3-2", "3-3-3", "CUSTOM"],
  ELEVEN_V_ELEVEN: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "CUSTOM"],
};

function matchSize(format: FootballFormat): number {
  return FOOTBALL_FORMAT_PLAYER_COUNTS[format];
}

function defaultFormation(format: FootballFormat): string {
  return FORMATIONS[format][0] ?? "CUSTOM";
}

function formationFitsFormat(formation: string, format: FootballFormat): boolean {
  if (!/^\d+(?:-\d+){1,4}$/.test(formation)) return false;
  const outfield = formation
    .split("-")
    .map(Number)
    .reduce((total, count) => total + count, 0);
  return outfield === matchSize(format) - 1;
}

function lineRole(index: number, totalLines: number): PositionRole {
  if (index === 0) return "CB";
  if (index === totalLines - 1) return "ST";
  if (totalLines >= 4 && index === 1) return "DM";
  if (totalLines >= 4 && index === totalLines - 2) return "AM";
  return "CM";
}

function presetSlots(formation: string, format: FootballFormat): DraftSlot[] {
  const size = matchSize(format);
  if (formation === "CUSTOM") {
    return Array.from({ length: size }, (_, index) => ({
      teamPlayerId: null,
      position: index === 0 ? "GK" : "ANY",
      x: index === 0 ? 50 : 15 + ((index - 1) % 4) * 23,
      y: index === 0 ? 90 : 68 - Math.floor((index - 1) / 4) * 22,
      isStarter: true,
      sortOrder: index,
    }));
  }

  const lines = formation
    .split("-")
    .map(Number)
    .filter((count) => Number.isFinite(count) && count > 0);
  const slots: DraftSlot[] = [
    { teamPlayerId: null, position: "GK", x: 50, y: 90, isStarter: true, sortOrder: 0 },
  ];
  const top = 68;
  const bottom = 18;
  lines.forEach((count, lineIndex) => {
    const y =
      lines.length === 1 ? 45 : top - ((top - bottom) * lineIndex) / Math.max(lines.length - 1, 1);
    const role = lineRole(lineIndex, lines.length);
    for (let playerIndex = 0; playerIndex < count; playerIndex += 1) {
      slots.push({
        teamPlayerId: null,
        position: role,
        x: ((playerIndex + 1) * 100) / (count + 1),
        y,
        isStarter: true,
        sortOrder: slots.length,
      });
    }
  });
  return slots.slice(0, size);
}

type TeamApi = {
  currentLineup: (teamId: string) => Promise<TeamLineupView | null>;
  saveCurrentLineup: (teamId: string, input: TeamLineupInput) => Promise<TeamLineupView>;
};

type TeamLineupManagerProps = {
  readonly api: TeamApi;
  readonly team: TeamControlDetail;
  readonly onRun: (
    action: () => Promise<unknown>,
    success: string,
    refreshTeam?: boolean,
  ) => Promise<void>;
};

export function TeamLineupManager({ api, team, onRun }: TeamLineupManagerProps) {
  const initialFormat: FootballFormat = "ELEVEN_V_ELEVEN";
  const initialFormation = defaultFormation(initialFormat);
  const [name, setName] = useState(`${team.name} Matchday`);
  const [format, setFormat] = useState<FootballFormat>(initialFormat);
  const [formation, setFormation] = useState(initialFormation);
  const [customFormation, setCustomFormation] = useState("4-1-4-1");
  const [slots, setSlots] = useState<DraftSlot[]>(() =>
    presetSlots(initialFormation, initialFormat),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const roster: TeamRosterPlayer[] = team.players;
  const selectedIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.teamPlayerId ? [slot.teamPlayerId] : []))),
    [slots],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");

    void api
      .currentLineup(team.id)
      .then((lineup) => {
        if (!active) return;
        if (!lineup) {
          const nextFormat: FootballFormat = "ELEVEN_V_ELEVEN";
          const nextFormation = defaultFormation(nextFormat);
          setName(`${team.name} Matchday`);
          setFormat(nextFormat);
          setFormation(nextFormation);
          setCustomFormation("4-1-4-1");
          setSlots(presetSlots(nextFormation, nextFormat));
          return;
        }

        const nextFormat = lineup.matchFormat as FootballFormat;
        const isPreset = FORMATIONS[nextFormat]?.includes(lineup.formation) ?? false;
        setName(lineup.name);
        setFormat(nextFormat);
        setFormation(isPreset ? lineup.formation : "CUSTOM");
        setCustomFormation(isPreset ? "4-1-4-1" : lineup.formation);
        setSlots(
          lineup.slots.map((slot, index) => ({
            teamPlayerId: slot.teamPlayerId,
            position: slot.position as PositionRole,
            x: slot.x,
            y: slot.y,
            isStarter: slot.isStarter,
            sortOrder: index,
          })),
        );
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setLoadError(reason instanceof Error ? reason.message : "Unable to load current lineup");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, team.id, team.name]);

  const effectiveFormation = formation === "CUSTOM" ? customFormation.trim() : formation;
  const assignedCount = slots.filter((slot) => slot.teamPlayerId).length;
  const requiredCount = matchSize(format);
  const validFormation = formationFitsFormat(effectiveFormation, format);
  const canSave = name.trim().length > 0 && validFormation && slots.length === requiredCount;
  const canPublish =
    canSave && assignedCount === requiredCount && slots.every((slot) => slot.isStarter);

  const previewLineup: TeamLineupView = {
    id: "draft",
    name,
    formation: effectiveFormation,
    matchFormat: format,
    published: false,
    isCurrent: true,
    slots: slots.map((slot, index) => ({
      id: `draft-${index}`,
      teamPlayerId: slot.teamPlayerId,
      position: slot.position,
      x: slot.x,
      y: slot.y,
      isStarter: slot.isStarter,
      sortOrder: index,
    })),
  };

  function chooseFormat(next: FootballFormat) {
    const nextFormation = defaultFormation(next);
    setFormat(next);
    setFormation(nextFormation);
    setCustomFormation(nextFormation);
    setSlots(presetSlots(nextFormation, next));
  }

  function chooseFormation(next: string) {
    setFormation(next);
    if (next !== "CUSTOM") {
      setSlots(presetSlots(next, format));
    } else {
      setCustomFormation(defaultFormation(format));
      setSlots(presetSlots("CUSTOM", format));
    }
  }

  async function save(publish: boolean) {
    if (!canSave || (publish && !canPublish)) return;
    const input: TeamLineupInput = {
      name: name.trim(),
      formation: effectiveFormation,
      matchFormat: format,
      published: publish,
      slots: slots.map((slot, index) => ({
        teamPlayerId: slot.teamPlayerId,
        position: slot.position,
        x: slot.x,
        y: slot.y,
        isStarter: slot.isStarter,
        sortOrder: index,
      })),
    };
    await onRun(
      () => api.saveCurrentLineup(team.id, input),
      publish ? "Lineup published." : "Lineup draft saved.",
    );
  }

  if (loading) {
    return (
      <section className="panel team-lineup-manager">
        <p className="status">Loading current lineup…</p>
      </section>
    );
  }

  return (
    <section className="panel team-lineup-manager">
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}
      >
        <div>
          <p className="eyebrow">MATCHDAY SHAPE</p>
          <h3 style={{ margin: "4px 0 0" }}>Formation &amp; Lineup</h3>
        </div>
        <span className="count-chip">
          {assignedCount}/{requiredCount}
        </span>
      </div>

      {loadError ? <p className="error">{loadError}</p> : null}

      <label>
        Lineup name
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>

      <div>
        <strong style={{ display: "block", marginBottom: 8 }}>Match size</strong>
        <div className="format-grid">
          {MATCH_FORMATS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={format === item.value ? "format-chip active" : "format-chip"}
              onClick={() => chooseFormat(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label>
        Formation
        <select value={formation} onChange={(event) => chooseFormation(event.target.value)}>
          {FORMATIONS[format].map((item) => (
            <option key={item} value={item}>
              {item === "CUSTOM" ? "Custom shape…" : item}
            </option>
          ))}
        </select>
      </label>

      {formation === "CUSTOM" ? (
        <label>
          Custom formation
          <input
            value={customFormation}
            onChange={(event) => setCustomFormation(event.target.value)}
            placeholder={defaultFormation(format)}
            pattern="[0-9]+(-[0-9]+){1,4}"
            maxLength={20}
          />
          {!validFormation ? (
            <small className="muted">
              Formation must total {requiredCount - 1} outfield players for {requiredCount}v
              {requiredCount}.
            </small>
          ) : null}
        </label>
      ) : null}

      <TeamLineupPitch teamName={team.name} lineup={previewLineup} roster={roster} />

      <div style={{ display: "grid", gap: 10 }}>
        {slots.map((slot, index) => (
          <article className="slot-card" key={index}>
            <div className="slot-row">
              <label>
                Player
                <select
                  value={slot.teamPlayerId ?? ""}
                  onChange={(event) => {
                    const teamPlayerId = event.target.value || null;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, teamPlayerId } : item,
                      ),
                    );
                  }}
                >
                  <option value="">Choose player</option>
                  {roster.map((player) => {
                    const label =
                      player.user.presentation?.displayName ??
                      player.user.presentation?.username ??
                      player.userId;
                    const disabled = selectedIds.has(player.id) && slot.teamPlayerId !== player.id;
                    return (
                      <option key={player.id} value={player.id} disabled={disabled}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Role
                <select
                  value={slot.position}
                  onChange={(event) => {
                    const position = event.target.value as PositionRole;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, position } : item,
                      ),
                    );
                  }}
                >
                  {TEAM_POSITION_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formation === "CUSTOM" ? (
              <div className="slot-row">
                <label>
                  Horizontal {Math.round(slot.x)}%
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={slot.x}
                    onChange={(event) => {
                      const x = Number(event.target.value);
                      setSlots((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, x } : item,
                        ),
                      );
                    }}
                  />
                </label>
                <label>
                  Vertical {Math.round(slot.y)}%
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={slot.y}
                    onChange={(event) => {
                      const y = Number(event.target.value);
                      setSlots((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, y } : item,
                        ),
                      );
                    }}
                  />
                </label>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!roster.length ? (
        <p className="muted">Add players to the Team roster before assigning lineup slots.</p>
      ) : null}

      <div className="slot-actions">
        <button type="button" disabled={!canSave} onClick={() => void save(false)}>
          Save draft
        </button>
        <button type="button" disabled={!canPublish} onClick={() => void save(true)}>
          Publish lineup
        </button>
      </div>

      {!canPublish ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Assign all {requiredCount} starters and use a valid {requiredCount}v{requiredCount}{" "}
          formation before publishing. Drafts may keep slots unassigned.
        </p>
      ) : null}
    </section>
  );
}
