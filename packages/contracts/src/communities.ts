import { z } from "zod";

export const communityVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const communityJoinPolicySchema = z.enum(["OPEN", "APPROVAL_REQUIRED"]);
export const communityJoinRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
]);
export const communityRoleSchema = z.enum(["FOUNDER", "COACH", "MEMBER"]);

const optionalUrl = z.string().trim().url().max(2000).optional().nullable();

export const communityCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable(),
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
  visibility: communityVisibilitySchema.default("PUBLIC"),
});

export const communityUpdateSchema = communityCreateSchema.partial();
export const communityMemberAddSchema = z.object({
  username: z.string().trim().min(3).max(64),
});

export type CommunityVisibility = z.infer<typeof communityVisibilitySchema>;
export type CommunityJoinPolicy = z.infer<typeof communityJoinPolicySchema>;
export type CommunityJoinRequestStatus = z.infer<typeof communityJoinRequestStatusSchema>;
export type CommunityRole = z.infer<typeof communityRoleSchema>;
export type CommunityCreateInput = z.infer<typeof communityCreateSchema>;
export type CommunityUpdateInput = z.infer<typeof communityUpdateSchema>;

export type CommunityPublicSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  houma: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  visibility: CommunityVisibility;
  createdAt: string;
};

export type CommunityPublicDetail = Omit<CommunityPublicSummary, "createdAt"> & {
  _count: { teams: number; memberships: number };
};

export type CommunityJoinResult =
  | { status: "JOINED"; membership: { role: CommunityRole } }
  | { status: "PENDING"; request: CommunityJoinRequest };

export type CommunityJoinRequest = {
  id: string;
  communityId: string;
  userId: string;
  status: CommunityJoinRequestStatus;
  requestedAt: string;
  resolvedAt: string | null;
};

export type CommunityJoinRequestForFounder = CommunityJoinRequest & {
  presentation: {
    displayName: string;
    username: string;
    photoUrl: string | null;
  } | null;
};
