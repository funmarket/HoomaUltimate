import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  createHoomaApi,
  HoomaApiError,
  request,
  type HoomaApi,
  type HoomaTransport,
} from "./api";

type FrontendContextValue = {
  readonly api: HoomaApi;
  readonly transport: HoomaTransport;
  readonly protectedError: (reason: unknown, fallback: string) => string;
  readonly authenticationHref: (returnTo: string) => string | null;
  readonly createAccountFromDeliveryIdentity: () => Promise<void>;
};

const FrontendContext = createContext<FrontendContextValue | null>(null);

export function HoomaFrontendProvider({
  transport,
  children,
}: {
  readonly transport: HoomaTransport;
  readonly children: ReactNode;
}) {
  const api = useMemo(() => createHoomaApi(transport), [transport]);
  const value = useMemo<FrontendContextValue>(
    () => ({
      api,
      transport,
      protectedError(reason, fallback) {
        if (reason instanceof HoomaApiError && reason.code === "AUTH_REQUIRED") {
          transport.onAuthenticationRequired?.();
        }
        return reason instanceof Error ? reason.message : fallback;
      },
      authenticationHref(returnTo) {
        return transport.authenticationHref?.(returnTo) ?? null;
      },
      async createAccountFromDeliveryIdentity() {
        await request<{ ok: true }>(transport, "/api/public/v1/auth/telegram/account", {
          method: "POST",
        });
      },
    }),
    [api, transport],
  );
  return <FrontendContext.Provider value={value}>{children}</FrontendContext.Provider>;
}

export function useHoomaFrontend(): FrontendContextValue {
  const value = useContext(FrontendContext);
  if (!value) throw new Error("useHoomaFrontend must be used inside HoomaFrontendProvider");
  return value;
}
