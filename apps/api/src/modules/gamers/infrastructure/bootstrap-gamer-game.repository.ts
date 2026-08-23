import type { GamerGameRepository, GamerGameSummary } from "../application/gamer-game.repository.js";

const LAUNCH_GAMES: readonly GamerGameSummary[] = [
  { id: "ea-sports-fc", slug: "ea-sports-fc", name: "EA SPORTS FC", status: "ACTIVE" },
  { id: "call-of-duty", slug: "call-of-duty", name: "Call of Duty", status: "ACTIVE" },
  { id: "efootball", slug: "efootball", name: "eFootball", status: "ACTIVE" },
  { id: "tekken", slug: "tekken", name: "Tekken", status: "ACTIVE" },
  { id: "fortnite", slug: "fortnite", name: "Fortnite", status: "ACTIVE" }
] as const;

export class BootstrapGamerGameRepository implements GamerGameRepository {
  async listActive(): Promise<GamerGameSummary[]> {
    return LAUNCH_GAMES.filter((game) => game.status === "ACTIVE").map((game) => ({ ...game }));
  }

  async getActive(slug: string): Promise<GamerGameSummary | null> {
    const game = LAUNCH_GAMES.find((candidate) => candidate.slug === slug && candidate.status === "ACTIVE");
    return game ? { ...game } : null;
  }
}
