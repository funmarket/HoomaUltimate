import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend, type ManagedTeam } from "@hooma/frontend";

type WebAccountState = { readonly me: MeResponse | null; readonly managedTeams: readonly ManagedTeam[]; readonly loading: boolean; readonly error: string; readonly refresh: () => Promise<void> };
const WebAccountContext = createContext<WebAccountState | null>(null);
export function WebAccountProvider({ children }: { readonly children: ReactNode }) {
  const { api } = useHoomaFrontend(); const [me, setMe] = useState<MeResponse | null>(null); const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function refresh() { setLoading(true); setError(""); try { const currentUser = await api.identity.meOptional(); setMe(currentUser); if (!currentUser) { setManagedTeams([]); return; } try { setManagedTeams(await api.teams.managed()); } catch (reason) { setManagedTeams([]); setError(reason instanceof Error ? reason.message : "Unable to load Team authority"); } } catch (reason) { setMe(null); setManagedTeams([]); setError(reason instanceof Error ? reason.message : "Unable to load account state"); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, [api]);
  const value = useMemo<WebAccountState>(() => ({ me, managedTeams, loading, error, refresh }), [me, managedTeams, loading, error]);
  return <WebAccountContext.Provider value={value}>{children}</WebAccountContext.Provider>;
}
export function useWebAccount(): WebAccountState { const value = useContext(WebAccountContext); if (!value) throw new Error("useWebAccount must be used inside WebAccountProvider"); return value; }
