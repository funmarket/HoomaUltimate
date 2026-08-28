import { z } from "zod";

export const platformManagerCapabilitySchema = z.enum(["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"]);

export const appManagerUpdateSchema = z.object({
  capabilities: z.array(platformManagerCapabilitySchema).max(2),
});

export type PlatformManagerCapability = z.infer<typeof platformManagerCapabilitySchema>;
export type AppManagerUpdateInput = z.infer<typeof appManagerUpdateSchema>;

export interface AdminAccess {
  readonly isPlatformOwner: boolean;
  readonly managerCapabilities: readonly PlatformManagerCapability[];
}

export interface AppManagerSummary {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly capabilities: readonly PlatformManagerCapability[];
}
