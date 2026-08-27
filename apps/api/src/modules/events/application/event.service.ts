import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import type { CommunityService } from "../../communities/application/community.service.js";
import type { PlaceService } from "../../places/application/place.service.js";
import { EventError } from "../domain/event-error.js";
import type { EventPublicListInput, EventRepository } from "./event.repository.js";

export class EventService {
  constructor(
    private readonly repository: EventRepository,
    private readonly communities: CommunityService,
    private readonly places: PlaceService,
  ) {}

  listPublic(input: Omit<EventPublicListInput, "from"> & { from?: Date }) {
    return this.repository.listPublic({
      ...input,
      from: input.from ?? new Date(Date.now() - 6 * 60 * 60_000),
      limit: Math.min(Math.max(input.limit, 1), 100),
    });
  }

  async getPublic(eventId: string) {
    const event = await this.repository.getPublic(eventId);
    if (!event) throw new EventError("EVENT_NOT_FOUND", "Event not found");
    return event;
  }

  async getManaged(userId: string, eventId: string) {
    await this.requireManage(userId, eventId);
    return this.getPublic(eventId);
  }

  async getMyRsvp(userId: string, eventId: string) {
    const access = await this.repository.access(eventId);
    if (!access) throw new EventError("EVENT_NOT_FOUND", "Event not found");
    return { rsvp: await this.repository.getRsvp(eventId, userId) };
  }

  async requireMemberContent(userId: string, eventId: string): Promise<void> {
    if (!(await this.repository.canViewMemberContent(eventId, userId))) {
      throw new EventError(
        "EVENT_MEMBER_CONTENT_FORBIDDEN",
        "Event participation or management access required",
      );
    }
  }

  async formationRoster(userId: string, eventId: string) {
    await this.requireMemberContent(userId, eventId);
    return { players: await this.repository.formationRoster(eventId) };
  }

  async create(userId: string, input: EventCreateInput) {
    if (input.type === "PLAY") {
      if (!input.communityId) throw new EventError("COMMUNITY_REQUIRED", "Community is required");
      await this.communities.requireCoach(input.communityId, userId);
    } else {
      if (!input.placeId) throw new EventError("PLACE_REQUIRED", "Approved Place is required");
      await this.places.getPublic(input.placeId);
      if (
        input.watch?.kind === "CULTURAL" &&
        !(await this.places.isVerifiedOwner(input.placeId, userId))
      ) {
        throw new EventError(
          "WATCH_CULTURAL_OWNER_REQUIRED",
          "Only a verified owner of this Place can publish Cultural events",
        );
      }
    }
    if (input.entryFeeMinor > 0) {
      throw new EventError(
        "EVENT_PAYMENTS_NOT_ENABLED",
        "Paid RSVP will be enabled by the Payments slice",
      );
    }
    return this.repository.create(userId, input);
  }

  async update(userId: string, eventId: string, input: EventUpdateInput) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED")
      throw new EventError("EVENT_NOT_EDITABLE", "Only published events can be edited");
    if (
      access.type === "WATCH" &&
      access.placeId &&
      access.watchKind === "CULTURAL" &&
      !(await this.places.isVerifiedOwner(access.placeId, userId))
    ) {
      throw new EventError(
        "WATCH_CULTURAL_OWNER_REQUIRED",
        "Only a verified owner of this Place can manage Cultural events",
      );
    }
    try {
      return await this.repository.update(eventId, input);
    } catch (error) {
      if (error instanceof Error && error.message === "EVENT_TIME_INVALID")
        throw new EventError("EVENT_TIME_INVALID", "Event end time must be after start time");
      if (error instanceof Error && error.message === "WATCH_EVENT_KIND_IMMUTABLE")
        throw new EventError(
          "WATCH_EVENT_KIND_IMMUTABLE",
          "A Watch event cannot change between Match and Cultural after publishing",
        );
      throw error;
    }
  }

  async cancel(userId: string, eventId: string) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED")
      throw new EventError("EVENT_NOT_CANCELLABLE", "Event is not active");
    return this.repository.cancel(eventId);
  }

  async complete(userId: string, eventId: string) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED")
      throw new EventError("EVENT_NOT_COMPLETABLE", "Event is not active");
    return this.repository.complete(eventId);
  }

  async join(userId: string, eventId: string) {
    const access = await this.repository.access(eventId);
    if (!access || access.status !== "PUBLISHED")
      throw new EventError("EVENT_NOT_FOUND", "Active event not found");
    if (access.entryFeeMinor > 0n)
      throw new EventError(
        "EVENT_PAYMENTS_NOT_ENABLED",
        "Paid RSVP will be enabled by the Payments slice",
      );
    try {
      return await this.repository.join(eventId, userId);
    } catch (error) {
      if (error instanceof Error && error.message === "EVENT_FULL")
        throw new EventError("EVENT_FULL", "Event is full and waitlist is disabled");
      if (error instanceof Error && error.message === "EVENT_NOT_ACTIVE")
        throw new EventError("EVENT_NOT_ACTIVE", "Event is no longer open for RSVP");
      throw error;
    }
  }

  async cancelRsvp(userId: string, eventId: string) {
    try {
      return await this.repository.cancelRsvp(eventId, userId);
    } catch (error) {
      if (error instanceof Error && error.message === "RSVP_ALREADY_ATTENDED")
        throw new EventError("RSVP_ALREADY_ATTENDED", "An attended RSVP cannot be cancelled");
      throw error;
    }
  }

  async createFormation(userId: string, eventId: string, input: EventFormationInput) {
    await this.requireManage(userId, eventId);
    const roster = await this.repository.formationRoster(eventId);
    const allowed = new Set(roster.map((player) => player.userId));
    const used = new Set<string>();
    for (const slot of input.slots) {
      if (!slot.userId) continue;
      if (!allowed.has(slot.userId)) {
        throw new EventError(
          "EVENT_FORMATION_INVALID_PLAYER",
          "Formation players must have a confirmed or attended RSVP for this event",
        );
      }
      if (used.has(slot.userId)) {
        throw new EventError(
          "EVENT_FORMATION_DUPLICATE_PLAYER",
          "A player can appear only once in an event formation",
        );
      }
      used.add(slot.userId);
    }
    return this.repository.createFormation(userId, eventId, input);
  }

  async listFormations(userId: string, eventId: string) {
    await this.requireMemberContent(userId, eventId);
    return this.repository.listFormations(eventId);
  }

  async checkIn(
    userId: string,
    eventId: string,
    latitude?: number | null,
    longitude?: number | null,
  ) {
    try {
      return await this.repository.checkIn(eventId, userId, latitude, longitude);
    } catch (error) {
      if (error instanceof Error && error.message === "EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP") {
        throw new EventError(
          "EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP",
          "Confirmed RSVP required for check-in",
        );
      }
      throw error;
    }
  }

  async chat(userId: string, eventId: string) {
    const messages = await this.repository.listChat(eventId, userId);
    if (!messages)
      throw new EventError("EVENT_CHAT_FORBIDDEN", "Active RSVP and open chat window required");
    return messages;
  }

  async postChat(userId: string, eventId: string, body: string) {
    const message = await this.repository.postChat(eventId, userId, body);
    if (!message)
      throw new EventError("EVENT_CHAT_FORBIDDEN", "Active RSVP and open chat window required");
    return message;
  }

  private async requireManage(userId: string, eventId: string) {
    const access = await this.repository.access(eventId);
    if (!access) throw new EventError("EVENT_NOT_FOUND", "Event not found");
    if (access.createdByUserId === userId) return access;
    if (access.type === "PLAY" && access.communityId) {
      await this.communities.requireCoach(access.communityId, userId);
      return access;
    }
    throw new EventError("EVENT_MANAGE_FORBIDDEN", "Only the Watch event creator can manage it");
  }
}
