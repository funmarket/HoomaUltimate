import type {
  LoginMethodsResponse,
  TelegramLinkClaimInput,
  TelegramLinkCodeResponse,
  WebCredentialAttachInput,
} from "@hooma/contracts/auth-linking";
import { request, type HoomaTransport } from "./http.js";

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

export function createTelegramLinkCode(
  transport: HoomaTransport,
): Promise<TelegramLinkCodeResponse> {
  return request<TelegramLinkCodeResponse>(transport, "/api/v1/auth/telegram-link/code", {
    method: "POST",
  });
}

export function claimTelegramLink(
  transport: HoomaTransport,
  input: TelegramLinkClaimInput,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(transport, "/api/public/v1/auth/telegram-link/claim", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
