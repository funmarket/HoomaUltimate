import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { webApi } from "../api/client";
import { teamApi, type ManagedTeam } from "../api/team-client";

type WebAccountState = {
  readonly me: MeResponse | null;
  readonly managedTeams: readonly ManagedTeam[];
  readonly loading: boolean;
  readonly error: string;
  readonly refresh: () => Promise<void>;
};

const WebAccountContext = createContext<WebAccountState | null>(null);

export function WebAccountProvider({ children }: { readonly children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const currentUser = await webApi.meOptional();
      setMe(currentUser);
      if (!currentUser) {
        setManagedTeams([]);
        return;
      }
      try {
        setManagedTeams(await teamApi.managed());
      } catch (reason) {
        setManagedTeams([]);
        setError(reason instanceof Error ? reason.message : "Unable to load Team authority");
      }
    } catch (reason) {
      setMe(null);
      setManagedTeams([]);
      setError(reason instanceof Error ? reason.message : "Unable to load account state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<WebAccountState>(
    () => ({ me, managedTeams, loading, error, refresh }),
    [me, managedTeams, loading, error]
  );

  return <WebAccountContext.Provider value={value}>{children}</WebAccountContext.Provider>;
}

export function useWebAccount(): WebAccountState {
  const value = useContext(WebAccountContext);
  if (!value) throw new Error("useWebAccount must be used inside WebAccountProvider");
  return value;
}
