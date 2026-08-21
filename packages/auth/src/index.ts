export type AuthTransport = "web" | "telegram";

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly transports: readonly AuthTransport[];
}
