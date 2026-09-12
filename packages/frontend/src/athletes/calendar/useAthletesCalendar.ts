import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "../../context";
import { monthQueryRange } from "./date";

export function useAthletesCalendar(athletesCommunityId: string, monthKey: string) {
  const { api } = useHoomaFrontend();
  const range = useMemo(() => monthQueryRange(monthKey), [monthKey]);
  const [entries, setEntries] = useState<AthletesCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await api.athletes.calendar.list(athletesCommunityId, range.from, range.to));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load calendar");
    } finally {
      setLoading(false);
    }
  }, [api, athletesCommunityId, range.from, range.to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, loading, error, reload };
}
