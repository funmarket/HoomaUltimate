import type {
  GamerChallengerList,
  GamerGame,
  GamerGameCreateInput,
  GamerGameList,
  GamerProfile,
  GamerProfileInput,
} from "@hooma/contracts/gamers";
import { request, type HoomaTransport } from "../http";

export function createGamersApi(transport: HoomaTransport) {
  return {
    games: () => request<GamerGameList>(transport, "/api/public/v1/gamers/games"),
    game: (slug: string) =>
      request<GamerGame>(transport, `/api/public/v1/gamers/games/${encodeURIComponent(slug)}`),
    addGame: (input: GamerGameCreateInput) =>
      request<GamerGame>(transport, "/api/v1/gamers/games", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    challengers: (gameId: string) =>
      request<GamerChallengerList>(
        transport,
        `/api/public/v1/gamers/games/${encodeURIComponent(gameId)}/challengers`,
      ),
    myProfile: (gameId: string) =>
      request<GamerProfile | null>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/profile`,
      ),
    saveMyProfile: (gameId: string, input: GamerProfileInput) =>
      request<GamerProfile>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/profile`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
  };
}

export type GamersApi = ReturnType<typeof createGamersApi>;
