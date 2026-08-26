import type {
  GamerArenaMatchList,
  GamerChallenge,
  GamerChallengeCreateInput,
  GamerChallengeList,
  GamerChallengerList,
  GamerDiscoveryList,
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
    discovery: () => request<GamerDiscoveryList>(transport, "/api/public/v1/gamers/discovery"),
    arena: () => request<GamerArenaMatchList>(transport, "/api/public/v1/gamers/arena"),
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
    challenges: (gameId: string) =>
      request<GamerChallengeList>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges`,
      ),
    createChallenge: (gameId: string, input: GamerChallengeCreateInput) =>
      request<GamerChallenge>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    acceptChallenge: (gameId: string, challengeId: string) =>
      request<GamerChallenge>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges/${encodeURIComponent(challengeId)}/accept`,
        { method: "POST" },
      ),
    declineChallenge: (gameId: string, challengeId: string) =>
      request<GamerChallenge>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges/${encodeURIComponent(challengeId)}/decline`,
        { method: "POST" },
      ),
    cancelChallenge: (gameId: string, challengeId: string) =>
      request<GamerChallenge>(
        transport,
        `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges/${encodeURIComponent(challengeId)}/cancel`,
        { method: "POST" },
      ),
  };
}

export type GamersApi = ReturnType<typeof createGamersApi>;
