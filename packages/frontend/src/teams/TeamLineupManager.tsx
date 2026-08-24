import { useMemo, useState } from "react";
import {
  TEAM_POSITION_ROLES,
  type TeamLineupInput
} from "@hooma/contracts";
import type { TeamControlDetail, TeamRosterPlayer } from "../api";
import { TeamLineupPitch } from "./TeamLineupPitch";
import "./TeamLineupPitch.css";

type FootballFormat = TeamLineupInput["matchFormat"];

type DraftSlot = {
  userId: string | null;
  position: string;
  x: number;
  y: number;
  sortOrder: number;
};

const MATCH_FORMATS: Array<{ value: FootballFormat; label: string; size: number }> = [
  { value: "FIVE_V_FIVE", label: "5v5", size: 5 },
  { value: "SIX_V_SIX", label: "6v6", size: 6 },
  { value: "SEVEN_V_SEVEN", label: "7v7", size: 7 },
  { value: "EIGHT_V_EIGHT", label: "8v8", size: 8 },
  { value: "NINE_V_NINE", label: "9v9", size: 9 },
  { value: "ELEVEN_V_ELEVEN", label: "11v11", size: 11 }
];

const FORMATIONS: Record<FootballFormat, string[]> = {
  FIVE_V_FIVE: ["1-2-1", "2-1-1", "2-2", "CUSTOM"],
  SIX_V_SIX: ["2-2-1", "1-3-1", "2-1-2", "CUSTOM"],
  SEVEN_V_SEVEN: ["2-3-1", "3-2-1", "2-2-2", "CUSTOM"],
  EIGHT_V_EIGHT: ["3-3-1", "2-3-2", "3-2-2", "CUSTOM"],
  NINE_V_NINE: ["3-3-2", "4-3-1", "3-4-1", "CUSTOM"],
  ELEVEN_V_ELEVEN: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "CUSTOM"]
};

function matchSize(format: FootballFormat): number {
  return MATCH_FORMATS.find((item) => item.value === format)?.size ?? 11;
}

function defaultFormation(format: FootballFormat): string {
  return FORMATIONS[format][0] ?? "CUSTOM";
}

function lineRole(index: number, totalLines: number): string {
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
      userId: null,
      position: index === 0 ? "GK" : "ANY",
      x: index === 0 ? 50 : 15 + ((index - 1) % 4) * 23,
      y: index === 0 ? 90 : 68 - Math.floor((index - 1) / 4) * 22,
      sortOrder: index
    }));
  }

  const lines = formation.split("-").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const slots: DraftSlot[] = [{ userId: null, position: "GK", x: 50, y: 90, sortOrder: 0 }];
  const top = 68;
  const bottom = 18;
  lines.forEach((count, lineIndex) => {
    const y = lines.length === 1 ? 45 : top - ((top - bottom) * lineIndex) / Math.max(lines.length - 1, 1);
    const role = lineRole(lineIndex, lines.length);
    for (let playerIndex = 0; playerIndex < count; playerIndex += 1) {
      slots.push({
        userId: null,
        position: role,
        x: ((playerIndex + 1) * 100) / (count + 1),
        y,
        sortOrder: slots.length
      });
    }
  });
  return slots.slice(0, size);
}

type TeamApi = {
  createLineup: (teamId: string, input: TeamLineupInput) => Promise<unknown>;
};

type TeamLineupManagerProps = {
  readonly api: TeamApi;
  readonly team: TeamControlDetail;
  readonly onRun: (action: () => Promise<unknown>, success: string, refreshTeam?: boolean) => Promise<void>;
};

export function TeamLineupManager({ api, team, onRun }: TeamLineupManagerProps) {
  const initialFormat: FootballFormat = "ELEVEN_V_ELEVEN";
  const initialFormation = defaultFormation(initialFormat);
  const [name, setName] = useState(`${team.name} Matchday`);
  const [format, setFormat] = useState<FootballFormat>(initialFormat);
  const [formation, setFormation] = useState(initialFormation);
  const [customFormation, setCustomFormation] = useState("4-1-4-1");
  const [slots, setSlots] = useState<DraftSlot[]>(() => presetSlots(initialFormation, initialFormat));

  const roster: TeamRosterPlayer[] = team.players;
  const selectedIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.userId ? [slot.userId] : []))),
    [slots]
  );

  const effectiveFormation = formation === "CUSTOM" ? customFormation.trim() || "4-3-3" : formation;
  const assignedCount = slots.filter((slot) => slot.userId).length;
  const requiredCount = matchSize(format);
  const canPublish = assignedCount === requiredCount && name.trim().length > 0;

  const previewLineup = {
    id: "draft",
    name,
    formation: effectiveFormation,
    matchFormat: format,
    published: false,
    slots: slots.map((slot, index) => ({
      id: `draft-${index}`,
      userId: slot.userId,
      position: slot.position,
      x: slot.x,
      y: slot.y,
      sortOrder: index
    }))
  };

  function chooseFormat(next: FootballFormat) {
    const nextFormation = defaultFormation(next);
    setFormat(next);
    setFormation(nextFormation);
    setSlots(presetSlots(nextFormation, next));
  }

  function chooseFormation(next: string) {
    setFormation(next);
    if (next !== "CUSTOM") setSlots(presetSlots(next, format));
    else setSlots(presetSlots("CUSTOM", format));
  }

  async function save(publish: boolean) {
    const formationValue = formation === "CUSTOM" ? customFormation.trim() : formation;
    if (!/^\d+(?:-\d+){1,4}$/.test(formationValue)) {
      throw new Error("Formation must look like 4-3-3 or 4-2-3-1");
    }
    const input: TeamLineupInput = {
      name: name.trim(),
      formation: formationValue,
      matchFormat: format,
      published: publish,
      slots: slots.map((slot, index) => ({
        userId: slot.userId,
        position: slot.position,
        x: slot.x,
        y: slot.y,
        sortOrder: index
      }))
    };
    await onRun(() => api.createLineup(team.id, input), publish ? "Lineup published." : "Lineup draft saved.");
  }

  return (
    <section className="panel team-lineup-manager">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <p className="eyebrow">MATCHDAY SHAPE</p>
          <h3 style={{ margin: "4px 0 0" }}>Formation &amp; Lineup</h3>
        </div>
        <span className="count-chip">{assignedCount}/{requiredCount}</span>
      </div>

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
            placeholder="4-1-4-1"
            pattern="[0-9]+(-[0-9]+){1,4}"
            maxLength={20}
          />
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
                  value={slot.userId ?? ""}
                  onChange={(event) => {
                    const userId = event.target.value || null;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, userId } : item
                      )
                    );
                  }}
                >
                  <option value="">Choose player</option>
                  {roster.map((player) => {
                    const label =
                      player.user.presentation?.displayName ??
                      player.user.presentation?.username ??
                      player.userId;
                    const disabled = selectedIds.has(player.userId) && slot.userId !== player.userId;
                    return (
                      <option key={player.userId} value={player.userId} disabled={disabled}>
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
                    const position = event.target.value;
                    setSlots((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, position } : item
                      )
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
                          itemIndex === index ? { ...item, x } : item
                        )
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
                          itemIndex === index ? { ...item, y } : item
                        )
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
        <button type="button" disabled={!name.trim()} onClick={() => void save(false).catch(() => undefined)}>
          Save draft
        </button>
        <button type="button" disabled={!canPublish} onClick={() => void save(true).catch(() => undefined)}>
          Publish lineup
        </button>
      </div>

      {!canPublish ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Assign all {requiredCount} starters before publishing. Drafts can be saved incomplete.
        </p>
      ) : null}
    </section>
  );
}
