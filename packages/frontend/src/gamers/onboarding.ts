import type { ProfileResponse } from "@hooma/contracts/profile";
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
    joinGamers: () =>
      request<ProfileResponse>(transport, "/api/v1/me/profile/identities/gamer", {
        method: "POST",
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
