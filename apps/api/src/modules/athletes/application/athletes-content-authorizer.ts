import { AthletesError } from "../domain/athletes-error.js";
import type {
  AthletesCommunityRecord,
  AthletesRepository,
} from "./athletes.repository.js";

export interface AthletesMemberContentAuthorizer {
  requireMemberContent(userId: string, athletesCommunityId: string): Promise<void>;
}

export interface AthletesFounderContentAuthorizer {
  requireFounderContent(userId: string, athletesCommunityId: string): Promise<void>;
}

export type AthletesContentAuthorizer = AthletesMemberContentAuthorizer &
  AthletesFounderContentAuthorizer;

export class AthletesContentAuthorization implements AthletesContentAuthorizer {
  constructor(private readonly repository: AthletesRepository) {}

  async requireMemberContent(userId: string, athletesCommunityId: string): Promise<void> {
    const role = await this.repository.activeRole(athletesCommunityId, userId);
    if (!role) {
      throw new AthletesError("ATHLETES_MEMBER_REQUIRED", "Athletes membership required");
    }
  }

  async requireFounderContent(userId: string, athletesCommunityId: string): Promise<void> {
    await this.requireFounder(userId, athletesCommunityId);
  }

  async requireFounder(
    userId: string,
    athletesCommunityId: string,
  ): Promise<AthletesCommunityRecord> {
    const community = await this.repository.lifecycle(athletesCommunityId);
    if (!community || community.status !== "ACTIVE") {
      throw new AthletesError("ATHLETES_NOT_FOUND", "Athletes community not found");
    }
    const role = await this.repository.managerRole(athletesCommunityId, userId);
    if (role !== "FOUNDER") {
      throw new AthletesError(
        "ATHLETES_FOUNDER_REQUIRED",
        "Athletes Founder access required",
      );
    }
    return community;
  }
}
