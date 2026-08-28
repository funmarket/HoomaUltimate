import type {
  EaFcRoomCodeInput,
  GamerArenaMatchList,
  GamerChallenge,
  GamerChallengeCreateInput,
  GamerChallengeList,
  GamerChallengerList,
  GamerDiscoveryList,
  GamerDisputeList,
  GamerDisputeResolutionInput,
  GamerGame,
  GamerGameCreateInput,
  GamerGameList,
  GamerMatchSession,
  GamerMatchSide,
  GamerProfile,
  GamerProfileInput,
} from "@hooma/contracts/gamers";
import { request, type HoomaTransport } from "../http";

function challengeMatchPath(gameId: string, challengeId: string): string {
  return `/api/v1/gamers/games/${encodeURIComponent(gameId)}/challenges/${encodeURIComponent(challengeId)}/match`;
}

export function createGamersApi(transport: HoomaTransport) {
  return {
    games: () => request<GamerGameList>(transport, "/api/public/v1/gamers/games"),
    discovery: () => request<GamerDiscoveryList>(transport, "/api/public/v1/gamers/discovery"),
    arena: (cursor?: string) =>
      request<GamerArenaMatchList>(
        transport,
        `/api/public/v1/gamers/arena${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
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
    match: (gameId: string, challengeId: string) =>
      request<GamerMatchSession>(transport, challengeMatchPath(gameId, challengeId)),
    setMatchCode: (gameId: string, challengeId: string, input: EaFcRoomCodeInput) =>
      request<GamerMatchSession>(transport, `${challengeMatchPath(gameId, challengeId)}/code`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    submitMatchResult: (
      gameId: string,
      challengeId: string,
      input: { yourScore: number; opponentScore: number; proof: File },
    ) =>
      request<GamerMatchSession>(transport, `${challengeMatchPath(gameId, challengeId)}/result`, {
        method: "POST",
        headers: {
          "content-type": input.proof.type,
          "x-hooma-your-score": String(input.yourScore),
          "x-hooma-opponent-score": String(input.opponentScore),
        },
        body: input.proof,
      }),
    adminDisputes: () =>
      request<GamerDisputeList>(transport, "/api/v1/admin/queues/gamer-disputes"),
    resolveAdminDispute: (matchId: string, input: GamerDisputeResolutionInput) =>
      request<GamerMatchSession>(
        transport,
        `/api/v1/admin/queues/gamer-disputes/${encodeURIComponent(matchId)}/resolve`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    adminDisputeProof: async (matchId: string, side: GamerMatchSide): Promise<Blob> => {
      const headers = transport.getHeaders?.();
      const response = await fetch(
        `${transport.baseUrl}/api/v1/admin/queues/gamer-disputes/${encodeURIComponent(matchId)}/proof/${side.toLowerCase()}`,
        {
          ...(transport.credentials ? { credentials: transport.credentials } : {}),
          ...(headers ? { headers } : {}),
        },
      );
      if (!response.ok) throw new Error(`Unable to load match proof (${response.status})`);
      return response.blob();
    },
  };
}

export type GamersApi = ReturnType<typeof createGamersApi>;
