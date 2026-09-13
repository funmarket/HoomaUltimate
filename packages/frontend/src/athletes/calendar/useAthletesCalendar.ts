import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHoomaFrontend } from "../../context";
import { monthQueryRange } from "./date";

export function useAthletesCalendar(athletesCommunityId: string, monthKey: string) {
  const { api } = useHoomaFrontend();
  const range = useMemo(() => monthQueryRange(monthKey), [monthKey]);
  const [entries, setEntries] = useState<AthletesCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const nextEntries = await api.athletes.calendar.list(
        athletesCommunityId,
        range.from,
        range.to,
      );
      if (version !== generation.current) return;
      setEntries(nextEntries);
    } catch (reason) {
      if (version !== generation.current) return;
      setError(reason instanceof Error ? reason.message : "Unable to load calendar");
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [api, athletesCommunityId, range.from, range.to]);

  useEffect(() => {
    setEntries([]);
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);

  return { entries, loading, error, reload };
}
