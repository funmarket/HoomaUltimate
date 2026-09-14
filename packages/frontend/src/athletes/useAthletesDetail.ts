import type {
  AthletesJoinRequestForManager,
  AthletesMember,
  AthletesPublicDetail,
} from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoomaFrontend } from "../context";

export function useAthletesDetail(id: string) {
  const { api, protectedError } = useHoomaFrontend();
  const [detail, setDetail] = useState<AthletesPublicDetail | null>(null);
  const [members, setMembers] = useState<AthletesMember[]>([]);
  const [requests, setRequests] = useState<AthletesJoinRequestForManager[]>([]);
  const [memberNextCursor, setMemberNextCursor] = useState<string | null>(null);
  const [requestNextCursor, setRequestNextCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [requestsLoadingMore, setRequestsLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const mounted = useRef(true);
  const actionPending = useRef(false);
  const memberPagePending = useRef(false);
  const requestPagePending = useRef(false);

  const reloadDetail = useCallback(async () => {
    const current = version.current;
    const next = await api.athletes.detail(id);
    if (mounted.current && current === version.current) setDetail(next);
  }, [api, id]);

  const reloadMembers = useCallback(
    async (cursor?: string) => {
      if (memberPagePending.current) return;
      const current = version.current;
      memberPagePending.current = true;
      if (cursor) setMembersLoadingMore(true);
      setMembersError("");
      try {
        const page = await api.athletes.members(id, cursor);
        if (!mounted.current || current !== version.current) return;
        setMembers((previous) =>
          cursor
            ? [
                ...previous,
                ...page.items.filter(
                  (member) => !previous.some((existing) => existing.userId === member.userId),
                ),
              ]
            : page.items,
        );
        setMemberNextCursor(page.nextCursor);
      } catch (reason) {
        if (mounted.current && current === version.current) {
          setMembersError(protectedError(reason, "Unable to load members"));
        }
      } finally {
        memberPagePending.current = false;
        if (mounted.current && current === version.current) setMembersLoadingMore(false);
      }
    },
    [api, id, protectedError],
  );

  const reloadRequests = useCallback(
    async (cursor?: string) => {
      if (requestPagePending.current) return;
      const current = version.current;
      requestPagePending.current = true;
      if (cursor) setRequestsLoadingMore(true);
      setRequestsError("");
      try {
        const page = await api.athletes.joinRequests(id, cursor);
        if (!mounted.current || current !== version.current) return;
        setRequests((previous) =>
          cursor
            ? [
                ...previous,
                ...page.items.filter(
                  (request) => !previous.some((existing) => existing.id === request.id),
                ),
              ]
            : page.items,
        );
        setRequestNextCursor(page.nextCursor);
      } catch (reason) {
        if (mounted.current && current === version.current) {
          setRequestsError(protectedError(reason, "Unable to load join requests"));
        }
      } finally {
        requestPagePending.current = false;
        if (mounted.current && current === version.current) setRequestsLoadingMore(false);
      }
    },
    [api, id, protectedError],
  );

  const reload = useCallback(async () => {
    const current = ++version.current;
    const active = () => mounted.current && current === version.current;
    memberPagePending.current = false;
    requestPagePending.current = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setMembers([]);
    setRequests([]);
    setMemberNextCursor(null);
    setRequestNextCursor(null);
    setMembersError("");
    setRequestsError("");
    try {
      const next = await api.athletes.detail(id);
      if (!active()) return;
      setDetail(next);
      const manager = next.viewerRole === "FOUNDER" || next.viewerRole === "MODERATOR";
      const [memberResult, requestResult] = await Promise.allSettled([
        next.viewerRole
          ? api.athletes.members(id)
          : Promise.resolve({ items: [], nextCursor: null }),
        manager ? api.athletes.joinRequests(id) : Promise.resolve({ items: [], nextCursor: null }),
      ]);
      if (!active()) return;
      if (memberResult.status === "fulfilled") {
        setMembers(memberResult.value.items);
        setMemberNextCursor(memberResult.value.nextCursor);
      } else {
        setMembersError(protectedError(memberResult.reason, "Unable to load members"));
      }
      if (requestResult.status === "fulfilled") {
        setRequests(requestResult.value.items);
        setRequestNextCursor(requestResult.value.nextCursor);
      } else {
        setRequestsError(protectedError(requestResult.reason, "Unable to load join requests"));
      }
    } catch (reason) {
      if (active()) setError(protectedError(reason, "Unable to load Athletes community"));
    } finally {
      if (active()) setLoading(false);
    }
  }, [api, id, protectedError]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      version.current += 1;
      memberPagePending.current = false;
      requestPagePending.current = false;
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
    memberNextCursor,
    requestNextCursor,
    error,
    membersError,
    requestsError,
    notice,
    loading,
    membersLoadingMore,
    requestsLoadingMore,
    busy,
    reload,
    reloadDetail,
    reloadMembers,
    reloadRequests,
    act,
  };
}
