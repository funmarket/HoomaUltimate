import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend, type ManagedTeam } from "@hooma/frontend";

type AccountState = {
  readonly me: MeResponse | null;
  readonly managedTeams: readonly ManagedTeam[];
  readonly loading: boolean;
  readonly error: string;
  readonly refresh: () => Promise<boolean>;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { readonly children: ReactNode }) {
  const { api } = useHoomaFrontend();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(): Promise<boolean> {
    setLoading(true);
    setError("");
    try {
      const currentUser = await api.identity.meOptional();
      setMe(currentUser);
      if (!currentUser) {
        setManagedTeams([]);
        return true;
      }
      try {
        setManagedTeams(await api.teams.managed());
      } catch (reason) {
        setManagedTeams([]);
        setError(reason instanceof Error ? reason.message : "Unable to load Team authority");
      }
      return true;
    } catch (reason) {
      setMe(null);
      setManagedTeams([]);
      setError(reason instanceof Error ? reason.message : "Unable to load account state");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [api]);

  const value = useMemo<AccountState>(
    () => ({ me, managedTeams, loading, error, refresh }),
    [me, managedTeams, loading, error],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
