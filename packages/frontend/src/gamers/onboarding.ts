import type { ProfileResponse, ProfileUpdateInput } from "@hooma/contracts/profile";
import type {
  GamerGame,
  GamerGameList,
  GamerProfile,
  GamerProfileInput,
} from "@hooma/contracts/gamers";
import { request, type HoomaTransport } from "../http";

export function createGamerOnboardingApi(transport: HoomaTransport) {
  return {
    games: () => request<GamerGameList>(transport, "/api/public/v1/gamers/games"),
    profile: () => request<ProfileResponse>(transport, "/api/v1/me/profile"),
    updateProfile: (input: ProfileUpdateInput) =>
      request<ProfileResponse>(transport, "/api/v1/me/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    saveGameProfile: (game: GamerGame, input: GamerProfileInput) =>
      request<GamerProfile>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(game.id)}/profile`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
  };
}

export function gamerOptInProfileInput(profile: ProfileResponse): ProfileUpdateInput {
  return {
    username: profile.presentation.username,
    displayName: profile.presentation.displayName,
    photoUrl: profile.presentation.photoUrl,
    bio: profile.presentation.bio,
    identities: [...new Set([...profile.identities, "GAMER" as const])],
    player: profile.player
      ? {
          skillLevel: profile.player.skillLevel,
          preferredPositions: profile.player.preferredPositions,
        }
      : null,
  };
}
