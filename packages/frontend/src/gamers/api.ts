import type { GamerGame, GamerGameCreateInput, GamerGameList } from "@hooma/contracts/gamers";
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
  };
}

export type GamersApi = ReturnType<typeof createGamersApi>;
