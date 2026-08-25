import type {
  LoginMethodsResponse,
  TelegramOidcStartResponse,
  WebCredentialAttachInput,
} from "@hooma/contracts/auth-linking";
import { request, type HoomaTransport } from "./http";

export function readLoginMethods(transport: HoomaTransport): Promise<LoginMethodsResponse> {
  return request<LoginMethodsResponse>(transport, "/api/v1/me/login-methods");
}

export function attachWebCredential(
  transport: HoomaTransport,
  input: WebCredentialAttachInput,
): Promise<LoginMethodsResponse> {
  return request<LoginMethodsResponse>(transport, "/api/v1/auth/web-credential", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startTelegramWebLogin(
  transport: HoomaTransport,
  returnTo: string,
): Promise<TelegramOidcStartResponse> {
  return request<TelegramOidcStartResponse>(transport, "/api/public/v1/auth/telegram/web/start", {
    method: "POST",
    body: JSON.stringify({ returnTo }),
  });
}

export function startTelegramLink(
  transport: HoomaTransport,
  returnTo: string,
): Promise<TelegramOidcStartResponse> {
  return request<TelegramOidcStartResponse>(transport, "/api/v1/auth/telegram/link/start", {
    method: "POST",
    body: JSON.stringify({ returnTo }),
  });
}
