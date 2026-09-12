import type {
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
  AthletesCalendarRange,
} from "@hooma/contracts/athletes-calendar";
import type { AthletesContentAuthorizer } from "./athletes-content-authorizer.js";
import type { AthletesCalendarRepository } from "./athletes-calendar.repository.js";

export class AthletesCalendarService {
  constructor(
    private readonly authorizer: AthletesContentAuthorizer,
    private readonly repository: AthletesCalendarRepository,
  ) {}

  async list(userId: string, athletesCommunityId: string, range: AthletesCalendarRange) {
    await this.authorizer.requireMemberContent(userId, athletesCommunityId);
    return this.repository.listForCommunity(
      athletesCommunityId,
      new Date(range.from),
      new Date(range.to),
    );
  }

  async create(
    userId: string,
    athletesCommunityId: string,
    input: AthletesCalendarEntryCreateInput,
  ) {
    await this.authorizer.requireFounderContent(userId, athletesCommunityId);
    return this.repository.create(athletesCommunityId, userId, input);
  }

  async update(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarEntryUpdateInput,
  ) {
    await this.authorizer.requireFounderContent(userId, athletesCommunityId);
    return this.repository.update(athletesCommunityId, entryId, input);
  }

  async cancel(userId: string, athletesCommunityId: string, entryId: string) {
    await this.authorizer.requireFounderContent(userId, athletesCommunityId);
    return this.repository.cancel(athletesCommunityId, entryId);
  }
}
