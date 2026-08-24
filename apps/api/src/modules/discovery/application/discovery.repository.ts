export interface DiscoveryContextRecord {
  readonly communityId: string | null;
  readonly communityName: string | null;
  readonly city: string | null;
  readonly houma: string | null;
}

export interface DiscoveryEventRecord {
  readonly kind: "EVENT";
  readonly id: string;
  readonly type: "PLAY" | "WATCH";
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly context: DiscoveryContextRecord;
}

export interface DiscoveryTeamGameRecord {
  readonly kind: "TEAM_GAME";
  readonly id: string;
  readonly scheduledAt: Date;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly context: DiscoveryContextRecord;
}

export interface DiscoveryGamerMatchRecord {
  readonly kind: "GAMER_MATCH_READY";
  readonly id: string;
  readonly respondedAt: Date;
  readonly gameSlug: string;
  readonly gameName: string;
  readonly challengerName: string;
  readonly challengedName: string;
  readonly challengerHandle: string;
  readonly challengedHandle: string;
}

export type DiscoveryRecord =
  | DiscoveryEventRecord
  | DiscoveryTeamGameRecord
  | DiscoveryGamerMatchRecord;

export interface DiscoveryRepository {
  listCurrent(input: {
    readonly now: Date;
    readonly lookaheadUntil: Date;
    readonly justStartedSince: Date;
    readonly gamerActiveSince: Date;
    readonly limit: number;
  }): Promise<DiscoveryRecord[]>;
}
