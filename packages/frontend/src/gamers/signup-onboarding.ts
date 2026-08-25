import type { ProfileResponse, ProfileUpdateInput } from "@hooma/contracts/profile";
import type { GamerGame, GamerGameList, GamerProfile, GamerProfileInput } from "@hooma/contracts/gamers";
import { request, type HoomaTransport } from "../http";

export function createGamerSignupOnboardingApi(transport: HoomaTransport) {
  return {
    games: () => request<GamerGameList>(transport, "/api/public/v1/gamers/games"),
    profile: () => request<ProfileResponse>(transport, "/api/v1/me/profile"),
    updateProfile: (input: ProfileUpdateInput) =>
      request<ProfileResponse>(transport, "/api/v1/me/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    saveGameProfile: (game: GamerGame, input: GamerProfileInput) =>
      request<GamerProfile>(transport, `/api/v1/gamers/games/${encodeURIComponent(game.id)}/profile`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
  };
}
