import type {
  AthletesJoinRequestForManager,
  AthletesMember,
} from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoomaFrontend } from "../context";

function appendUnique<T>(previous: T[], incoming: T[], key: (item: T) => string): T[] {
  const known = new Set(previous.map(key));
  return [...previous, ...incoming.filter((item) => !known.has(key(item)))];
}

export function useAthletesMembershipPages(
  id: string,
  enabled: boolean,
  canManage: boolean,
) {
  const { api, protectedError } = useHoomaFrontend();
  const [members, setMembers] = useState<AthletesMember[]>([]);
  const [requests, setRequests] = useState<AthletesJoinRequestForManager[]>([]);
  const [membersNextCursor, setMembersNextCursor] = useState<string | null>(null);
  const [requestsNextCursor, setRequestsNextCursor] = useState<string | null>(null);
  const [membersError, setMembersError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const generation = useRef(0);

  const refreshMembers = useCallback(async () => {
    const current = generation.current;
    setMembersError("");
    try {
      const page = await api.athletes.members(id);
      if (current !== generation.current) return;
      setMembers(page.items);
      setMembersNextCursor(page.nextCursor);
    } catch (reason) {
      if (current === generation.current) {
        setMembersError(protectedError(reason, "Unable to load members"));
      }
    }
  }, [api, id, protectedError]);

  const refreshRequests = useCallback(async () => {
    const current = generation.current;
    setRequestsError("");
    try {
      const page = await api.athletes.joinRequests(id);
      if (current !== generation.current) return;
      setRequests(page.items);
      setRequestsNextCursor(page.nextCursor);
    } catch (reason) {
      if (current === generation.current) {
        setRequestsError(protectedError(reason, "Unable to load join requests"));
      }
    }
  }, [api, id, protectedError]);

  const refreshMembership = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([refreshMembers(), canManage ? refreshRequests() : Promise.resolve()]);
  }, [canManage, enabled, refreshMembers, refreshRequests]);

  const loadMoreMembers = useCallback(async () => {
    if (!membersNextCursor || loadingMoreMembers) return;
    const current = generation.current;
    setLoadingMoreMembers(true);
    setMembersError("");
    try {
      const page = await api.athletes.members(id, membersNextCursor);
      if (current !== generation.current) return;
      setMembers((previous) =>
        appendUnique(previous, page.items, (member) => member.userId),
      );
      setMembersNextCursor(page.nextCursor);
    } catch (reason) {
      if (current === generation.current) {
        setMembersError(protectedError(reason, "Unable to load members"));
      }
    } finally {
      if (current === generation.current) setLoadingMoreMembers(false);
    }
  }, [api, id, loadingMoreMembers, membersNextCursor, protectedError]);

  const loadMoreRequests = useCallback(async () => {
    if (!requestsNextCursor || loadingMoreRequests) return;
    const current = generation.current;
    setLoadingMoreRequests(true);
    setRequestsError("");
    try {
      const page = await api.athletes.joinRequests(id, requestsNextCursor);
      if (current !== generation.current) return;
      setRequests((previous) =>
        appendUnique(previous, page.items, (request) => request.id),
      );
      setRequestsNextCursor(page.nextCursor);
    } catch (reason) {
      if (current === generation.current) {
        setRequestsError(protectedError(reason, "Unable to load join requests"));
      }
    } finally {
      if (current === generation.current) setLoadingMoreRequests(false);
    }
  }, [api, id, loadingMoreRequests, protectedError, requestsNextCursor]);

  useEffect(() => {
    generation.current += 1;
    setMembers([]);
    setRequests([]);
    setMembersNextCursor(null);
    setRequestsNextCursor(null);
    setMembersError("");
    setRequestsError("");
    if (enabled) void refreshMembership();
    return () => {
      generation.current += 1;
    };
  }, [enabled, refreshMembership]);

  return {
    members,
    requests,
    membersNextCursor,
    requestsNextCursor,
    membersError,
    requestsError,
    loadingMoreMembers,
    loadingMoreRequests,
    refreshMembers,
    refreshRequests,
    refreshMembership,
    loadMoreMembers,
    loadMoreRequests,
  };
}
