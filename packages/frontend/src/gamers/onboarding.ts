import type { ProfileResponse, ProfileUpdateInput } from "@hooma/contracts/profile";
import type {
  GamerGame,
  GamerGameList,
  GamerProfile,
  GamerProfileInput,
} from "@hooma/contracts/gamers";
import { request, type HoomaTransport } from "../http";
import { createProfileApi } from "../profile-api";

export function createGamerOnboardingApi(transport: HoomaTransport) {
  const profileApi = createProfileApi(transport);
  return {
    games: () => request<GamerGameList>(transport, "/api/public/v1/gamers/games"),
    profile: () => profileApi.mine(),
    updateProfile: (input: ProfileUpdateInput) => profileApi.updateMine(input),
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
