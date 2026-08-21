import type { Request } from "express";
import type { AuthContext } from "../domain/auth-context.js";

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export function getAuth(request: Request): AuthContext {
  const auth = (request as AuthenticatedRequest).auth;
  if (!auth) throw new Error("Authentication middleware did not attach auth context");
  return auth;
}
