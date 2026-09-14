import type {
  AthletesJoinRequestForManager,
  AthletesMember,
  AthletesPublicDetail,
} from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoomaFrontend } from "../context";

function appendUnique<T>(previous: T[], incoming: T[], key: (item: T) => string): T[] {
  const existing = new Set(previous.map(key));
  return [...previous, ...incoming.filter((item) => !existing.has(key(item)))];
}

export function useAthletesDetail(id: string) {
  const { api, protectedError } = useHoomaFrontend();
  const [detail, setDetail] = useState<AthletesPublicDetail | null>(null);
  const [members, setMembers] = useState<AthletesMember[]>([]);
  const [requests, setRequests] = useState<AthletesJoinRequestForManager[]>([]);
  const [error, setError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [membersNextCursor, setMembersNextCursor] = useState<string | null>(null);
  const [requestsNextCursor, setRequestsNextCursor] = useState<string | null>(null);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [requestsLoadingMore, setRequestsLoadingMore] = useState(false);
  const version = useRef(0);
  const mounted = useRef(true);
  const actionPending = useRef(false);
  const membersPending = useRef(false);
  const requestsPending = useRef(false);

  const loadMembers = useCallback(
    async (cursor?: string, reset = false) => {
      if (membersPending.current) return;
      const current = version.current;
      membersPending.current = true;
      setMembersError("");
      if (cursor) setMembersLoadingMore(true);
      try {
        const page = await api.athletes.members(id, cursor);
        if (!mounted.current || current !== version.current) return;
        setMembers((previous) =>
          reset || !cursor
            ? page.items
            : appendUnique(previous, page.items, (member) => member.userId),
        );
        setMembersNextCursor(page.nextCursor);
      } catch (reason) {
        if (mounted.current && current === version.current) {
          setMembersError(protectedError(reason, "Unable to load members"));
        }
      } finally {
        membersPending.current = false;
        if (mounted.current && current === version.current) setMembersLoadingMore(false);
      }
    },
    [api, id, protectedError],
  );

  const loadRequests = useCallback(
    async (cursor?: string, reset = false) => {
      if (requestsPending.current) return;
      const current = version.current;
      requestsPending.current = true;
      setRequestsError("");
      if (cursor) setRequestsLoadingMore(true);
      try {
        const page = await api.athletes.joinRequests(id, cursor);
        if (!mounted.current || current !== version.current) return;
        setRequests((previous) =>
          reset || !cursor
            ? page.items
            : appendUnique(previous, page.items, (request) => request.id),
        );
        setRequestsNextCursor(page.nextCursor);
      } catch (reason) {
        if (mounted.current && current === version.current) {
          setRequestsError(protectedError(reason, "Unable to load join requests"));
        }
      } finally {
        requestsPending.current = false;
        if (mounted.current && current === version.current) setRequestsLoadingMore(false);
      }
    },
    [api, id, protectedError],
  );

  const reload = useCallback(async () => {
    const current = ++version.current;
    const active = () => mounted.current && current === version.current;
    membersPending.current = false;
    requestsPending.current = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setMembers([]);
    setRequests([]);
    setMembersNextCursor(null);
    setRequestsNextCursor(null);
    setMembersError("");
    setRequestsError("");
    try {
      const next = await api.athletes.detail(id);
      if (!active()) return;
      setDetail(next);
      const manager = next.viewerRole === "FOUNDER" || next.viewerRole === "MODERATOR";
      await Promise.all([
        next.viewerRole ? loadMembers(undefined, true) : Promise.resolve(),
        manager ? loadRequests(undefined, true) : Promise.resolve(),
      ]);
    } catch (reason) {
      if (active()) setError(protectedError(reason, "Unable to load Athletes community"));
    } finally {
      if (active()) setLoading(false);
    }
  }, [api, id, loadMembers, loadRequests, protectedError]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      version.current += 1;
      membersPending.current = false;
      requestsPending.current = false;
    };
  }, [reload]);

  async function act(
    operation: () => Promise<unknown>,
    success: string,
    after?: () => void | Promise<void>,
  ) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      if (!mounted.current) return;
      setNotice(success);
      if (after) await after();
      else await reload();
    } catch (reason) {
      if (mounted.current) setError(protectedError(reason, "Unable to complete this action"));
    } finally {
      actionPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return {
    detail,
    members,
    requests,
    error,
    membersError,
    requestsError,
    notice,
    loading,
    busy,
    membersNextCursor,
    requestsNextCursor,
    membersLoadingMore,
    requestsLoadingMore,
    reload,
    reloadMembers: () => loadMembers(undefined, true),
    reloadRequests: () => loadRequests(undefined, true),
    loadMoreMembers: () =>
      membersNextCursor ? loadMembers(membersNextCursor, false) : Promise.resolve(),
    loadMoreRequests: () =>
      requestsNextCursor ? loadRequests(requestsNextCursor, false) : Promise.resolve(),
    act,
  };
}
