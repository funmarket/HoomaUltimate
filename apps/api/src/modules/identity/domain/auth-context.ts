import type { AuthTransport } from "@hooma/auth";

export interface AuthContext {
  readonly userId: string;
  readonly transports: readonly AuthTransport[];
}
