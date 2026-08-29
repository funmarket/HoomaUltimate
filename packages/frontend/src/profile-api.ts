import type {
  ProfileIdentity,
  ProfileResponse,
  ProfileUpdateInput,
} from "@hooma/contracts/profile";
import type { WhistleList, WhistleListItem } from "./api";
import { request, type HoomaTransport } from "./http";

export type CanonicalPublicProfile = {
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
      request<CanonicalPublicProfile>(
        transport,
        `/api/public/v1/profiles/${encodeURIComponent(username)}`,
      ),
    directWhistles: (username: string) =>
      request<WhistleList>(
        transport,
        `/api/v1/whistles/users/${encodeURIComponent(username)}`,
      ),
    sendDirectWhistle: (username: string, body: string) =>
      request<{
        whistle: WhistleListItem;
        remainingToday: number;
        resetsAt: string;
      }>(
        transport,
        `/api/v1/whistles/users/${encodeURIComponent(username)}`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
  };
}
