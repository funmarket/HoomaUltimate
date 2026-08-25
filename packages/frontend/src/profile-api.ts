import type { ProfileIdentity, ProfileResponse, ProfileUpdateInput } from "@hooma/contracts/profile";
import { request, type HoomaTransport } from "./http";

export type PublicProfile = {
  presentation: {
    username: string;
    displayName: string;
    photoUrl: string | null;
    bio: string | null;
  };
  identities: ProfileIdentity[];
  player: {
    skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "MIXED";
    preferredPositions: string[];
    overallRating: number;
  } | null;
  teams: {
    id: string;
    name: string;
    slug: string;
    badgeUrl: string | null;
  }[];
};

export function createProfileApi(transport: HoomaTransport) {
  return {
    mine: () => request<ProfileResponse>(transport, "/api/v1/me/profile"),
    updateMine: (input: ProfileUpdateInput) =>
      request<ProfileResponse>(transport, "/api/v1/me/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    publicByUsername: (username: string) =>
      request<PublicProfile>(
        transport,
        `/api/public/v1/profiles/${encodeURIComponent(username)}`,
      ),
  };
}
