import type { AthletesCalendarEntryView } from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoomaFrontend } from "../context";
import { monthFetchRange } from "./athletes-calendar-time";

export function useAthletesCalendar(athletesCommunityId: string, monthKey: string) {
  const { api, protectedError } = useHoomaFrontend();
  const [entries, setEntries] = useState<AthletesCalendarEntryView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const range = monthFetchRange(monthKey);
      const page = await api.athletes.listCalendar(athletesCommunityId, range.from, range.to);
      if (version !== generation.current) return;
      setEntries(page.items);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (version === generation.current) {
        setError(protectedError(reason, "Unable to load Athletes Calendar"));
      }
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [api, athletesCommunityId, monthKey, protectedError]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const version = generation.current;
    setLoadingMore(true);
    setError("");
    try {
      const range = monthFetchRange(monthKey);
      const page = await api.athletes.listCalendar(
        athletesCommunityId,
        range.from,
        range.to,
        nextCursor,
      );
      if (version !== generation.current) return;
      setEntries((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (version === generation.current) {
        setError(protectedError(reason, "Unable to load more Athletes Calendar entries"));
      }
    } finally {
      if (version === generation.current) setLoadingMore(false);
    }
  }, [api, athletesCommunityId, loadingMore, monthKey, nextCursor, protectedError]);

  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);

  return { entries, loading, loadingMore, error, hasMore: nextCursor !== null, reload, loadMore };
}
