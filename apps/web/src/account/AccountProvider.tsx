import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { createPlatformManagementApi, useHoomaFrontend, type ManagedTeam } from "@hooma/frontend";

type AccountState = {
  readonly me: MeResponse | null;
  readonly managedTeams: readonly ManagedTeam[];
  readonly hasPlatformControlAccess: boolean;
  readonly loading: boolean;
  readonly error: string;
  readonly refresh: () => Promise<boolean>;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { readonly children: ReactNode }) {
  const { api, transport } = useHoomaFrontend();
  const platformManagement = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [hasPlatformControlAccess, setHasPlatformControlAccess] = useState(false);
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
        setHasPlatformControlAccess(false);
        return true;
      }
      try {
        const [teams, platformAccess] = await Promise.all([
          api.teams.managed(),
          platformManagement.admin.access(),
        ]);
        setManagedTeams(teams);
        setHasPlatformControlAccess(
          platformAccess.isPlatformOwner || platformAccess.managerCapabilities.length > 0,
        );
      } catch (reason) {
        setManagedTeams([]);
        setHasPlatformControlAccess(currentUser.platformRoles.includes("PLATFORM_ADMIN"));
        setError(reason instanceof Error ? reason.message : "Unable to load account authority");
      }
      return true;
    } catch (reason) {
      setMe(null);
      setManagedTeams([]);
      setHasPlatformControlAccess(false);
      setError(reason instanceof Error ? reason.message : "Unable to load account state");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [api, platformManagement]);

  const value = useMemo<AccountState>(
    () => ({ me, managedTeams, hasPlatformControlAccess, loading, error, refresh }),
    [me, managedTeams, hasPlatformControlAccess, loading, error],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
