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
  const [error, setError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const mounted = useRef(true);
  const actionPending = useRef(false);

  const reload = useCallback(async () => {
    const current = ++version.current;
    const active = () => mounted.current && current === version.current;
    setLoading(true);
    setError("");
    setDetail(null);
    setMembers([]);
    setRequests([]);
    setMembersError("");
    setRequestsError("");
    try {
      const next = await api.athletes.detail(id);
      if (!active()) return;
      setDetail(next);
      const manager = next.viewerRole === "FOUNDER" || next.viewerRole === "MODERATOR";
      const [memberResult, requestResult] = await Promise.allSettled([
        next.viewerRole ? api.athletes.members(id) : Promise.resolve([]),
        manager
          ? api.athletes.joinRequests(id).then((result) => result.requests)
          : Promise.resolve([]),
      ]);
      if (!active()) return;
      if (memberResult.status === "fulfilled") setMembers(memberResult.value);
      else setMembersError(protectedError(memberResult.reason, "Unable to load members"));
      if (requestResult.status === "fulfilled") setRequests(requestResult.value);
      else setRequestsError(protectedError(requestResult.reason, "Unable to load join requests"));
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
    };
  }, [reload]);

  async function act(operation: () => Promise<unknown>, success: string, after?: () => void) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      if (!mounted.current) return;
      setNotice(success);
      if (after) after();
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
    reload,
    act,
  };
}
