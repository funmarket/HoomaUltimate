import type {
  HelpRequest,
  HelpRequestCreateInput,
  HelpRequestList,
  HelpRequestListQuery,
} from "@hooma/contracts/requests";
import { RequestError } from "../domain/request-error.js";
import type {
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "./request.repository.js";

function serialize(record: HelpRequestRecord): HelpRequest {
  return {
    ...record,
    neededByAt: record.neededByAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    fulfilledAt: record.fulfilledAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializePage(page: {
  readonly items: readonly HelpRequestRecord[];
  readonly nextCursor: string | null;
}): HelpRequestList {
  return { items: page.items.map(serialize), nextCursor: page.nextCursor };
}

export class RequestService {
  constructor(
    private readonly repository: RequestRepository,
    private readonly visibility: RequestVisibilityReader,
  ) {}

  async create(userId: string, input: HelpRequestCreateInput): Promise<HelpRequest> {
    await this.requirePublisherAuthority(userId, input);
    await this.requireAudienceMembership(userId, input);
    return serialize(await this.repository.create(userId, input));
  }

  async listPublic(input: HelpRequestListQuery): Promise<HelpRequestList> {
    return serializePage(await this.repository.listPublic(input));
  }

  async getPublic(id: string): Promise<HelpRequest> {
    const request = await this.repository.getPublic(id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return serialize(request);
  }

  async listForMember(userId: string, input: HelpRequestListQuery): Promise<HelpRequestList> {
    return serializePage(await this.repository.listVisibleToMember(userId, input));
  }

  async getForMember(userId: string, id: string): Promise<HelpRequest> {
    const request = await this.repository.getVisibleToMember(userId, id);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return serialize(request);
  }

  private async requirePublisherAuthority(userId: string, input: HelpRequestCreateInput) {
    const publisher = input.publisher;
    if (publisher.publisherCommunityId) {
      const role = await this.visibility.communityRole(publisher.publisherCommunityId, userId);
      if (role !== "FOUNDER" && role !== "COACH") {
        throw new RequestError(
          "REQUEST_COMMUNITY_PUBLISHER_FORBIDDEN",
          "Founder or Coach access required",
        );
      }
      return;
    }

    if (publisher.publisherTeamId) {
      const responsibility = await this.visibility.teamResponsibility(
        publisher.publisherTeamId,
        userId,
      );
      if (responsibility !== "COACH") {
        throw new RequestError(
          "REQUEST_TEAM_PUBLISHER_FORBIDDEN",
          "Team Coach access required",
        );
      }
      return;
    }

    if (publisher.publisherAthletesCommunityId) {
      const role = await this.visibility.athletesRole(publisher.publisherAthletesCommunityId, userId);
      if (role !== "FOUNDER" && role !== "MODERATOR") {
        throw new RequestError(
          "REQUEST_ATHLETES_PUBLISHER_FORBIDDEN",
          "Athletes Founder or Moderator access required",
        );
      }
    }
  }

  private async requireAudienceMembership(userId: string, input: HelpRequestCreateInput) {
    if (input.audience.scope === "HOOMA_COMMUNITY") {
      if (!(await this.visibility.isCommunityMember(input.audience.communityId, userId))) {
        throw new RequestError(
          "REQUEST_AUDIENCE_MEMBERSHIP_REQUIRED",
          "HOOMA membership required",
        );
      }
      return;
    }

    if (
      input.audience.scope === "ATHLETES_COMMUNITY" &&
      !(await this.visibility.isAthletesMember(input.audience.athletesCommunityId, userId))
    ) {
      throw new RequestError(
        "REQUEST_AUDIENCE_MEMBERSHIP_REQUIRED",
        "Athletes membership required",
      );
    }
  }
}
