export interface TeamLifecycleRecord {
  readonly createdByUserId: string;
  readonly status: "ACTIVE" | "ARCHIVED";
}

export interface TeamLifecycleRepository {
  get(teamId: string): Promise<TeamLifecycleRecord | null>;
  isActive(teamId: string): Promise<boolean>;
  archive(teamId: string): Promise<void>;
}
