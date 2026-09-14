import type { AthletesCalendarEntryView } from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoomaFrontend } from "../context";
import { monthFetchRange } from "./athletes-calendar-time";

export function useAthletesCalendar(athletesCommunityId: string, monthKey: string) {
  const { api, protectedError } = useHoomaFrontend();
  const [entries, setEntries] = useState<AthletesCalendarEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const range = monthFetchRange(monthKey);
      const nextEntries = await api.athletes.listCalendar(
        athletesCommunityId,
        range.from,
        range.to,
      );
      if (version !== generation.current) return;
      setEntries(nextEntries);
    } catch (reason) {
      if (version === generation.current) {
        setError(protectedError(reason, "Unable to load Athletes Calendar"));
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [api, athletesCommunityId, monthKey, protectedError]);

  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);

  return { entries, loading, error, reload };
}
