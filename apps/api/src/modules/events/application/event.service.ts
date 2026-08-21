import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import { AppError } from "../../../http/errors/app-error.js";
import type { CommunityService } from "../../communities/application/community.service.js";
import type { EventPublicListInput, EventRepository } from "./event.repository.js";

export class EventService {
  constructor(
    private readonly repository: EventRepository,
    private readonly communities: CommunityService
  ) {}

  listPublic(input: Omit<EventPublicListInput, "from"> & { from?: Date }) {
    return this.repository.listPublic({
      ...input,
      from: input.from ?? new Date(Date.now() - 6 * 60 * 60_000),
      limit: Math.min(Math.max(input.limit, 1), 100)
    });
  }

  async getPublic(eventId: string) {
    const event = await this.repository.getPublic(eventId);
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
    return event;
  }

  async create(userId: string, input: EventCreateInput) {
    await this.communities.requireCoach(input.communityId, userId);
    if (input.entryFeeMinor > 0) {
      throw new AppError(409, "EVENT_PAYMENTS_NOT_ENABLED", "Paid RSVP will be enabled by the Payments slice");
    }
    return this.repository.create(userId, input);
  }

  async update(userId: string, eventId: string, input: EventUpdateInput) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED") throw new AppError(409, "EVENT_NOT_EDITABLE", "Only published events can be edited");
    try {
      return await this.repository.update(eventId, input);
    } catch (error) {
      if (error instanceof Error && error.message === "EVENT_TIME_INVALID") throw new AppError(400, "EVENT_TIME_INVALID", "Event end time must be after start time");
      throw error;
    }
  }

  async cancel(userId: string, eventId: string) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED") throw new AppError(409, "EVENT_NOT_CANCELLABLE", "Event is not active");
    return this.repository.cancel(eventId);
  }

  async complete(userId: string, eventId: string) {
    const access = await this.requireManage(userId, eventId);
    if (access.status !== "PUBLISHED") throw new AppError(409, "EVENT_NOT_COMPLETABLE", "Event is not active");
    return this.repository.complete(eventId);
  }

  async join(userId: string, eventId: string) {
    const access = await this.repository.access(eventId);
    if (!access || access.status !== "PUBLISHED") throw new AppError(404, "EVENT_NOT_FOUND", "Active event not found");
    if (access.entryFeeMinor > 0n) throw new AppError(409, "EVENT_PAYMENTS_NOT_ENABLED", "Paid RSVP will be enabled by the Payments slice");
    try {
      return await this.repository.join(eventId, userId);
    } catch (error) {
      if (error instanceof Error && error.message === "EVENT_FULL") throw new AppError(409, "EVENT_FULL", "Event is full and waitlist is disabled");
      if (error instanceof Error && error.message === "EVENT_NOT_ACTIVE") throw new AppError(409, "EVENT_NOT_ACTIVE", "Event is no longer open for RSVP");
      throw error;
    }
  }

  async cancelRsvp(userId: string, eventId: string) {
    try {
      return await this.repository.cancelRsvp(eventId, userId);
    } catch (error) {
      if (error instanceof Error && error.message === "RSVP_ALREADY_ATTENDED") throw new AppError(409, "RSVP_ALREADY_ATTENDED", "An attended RSVP cannot be cancelled");
      throw error;
    }
  }

  async createFormation(userId: string, eventId: string, input: EventFormationInput) {
    await this.requireManage(userId, eventId);
    return this.repository.createFormation(userId, eventId, input);
  }

  async listFormations(userId: string, eventId: string) {
    if (!(await this.repository.canViewMemberContent(eventId, userId))) throw new AppError(403, "EVENT_MEMBER_CONTENT_FORBIDDEN", "Event participation or management access required");
    return this.repository.listFormations(eventId);
  }

  checkIn(userId: string, eventId: string, latitude?: number | null, longitude?: number | null) {
    return this.repository.checkIn(eventId, userId, latitude, longitude).catch((error: unknown) => {
      if (error instanceof Error && error.message === "RSVP_REQUIRED") throw new AppError(403, "RSVP_REQUIRED", "Confirmed RSVP required for check-in");
      throw error;
    });
  }

  async chat(userId: string, eventId: string) {
    const messages = await this.repository.listChat(eventId, userId);
    if (!messages) throw new AppError(403, "EVENT_CHAT_FORBIDDEN", "Active RSVP and open chat window required");
    return messages;
  }

  async postChat(userId: string, eventId: string, body: string) {
    const message = await this.repository.postChat(eventId, userId, body);
    if (!message) throw new AppError(403, "EVENT_CHAT_FORBIDDEN", "Active RSVP and open chat window required");
    return message;
  }

  private async requireManage(userId: string, eventId: string) {
    const access = await this.repository.access(eventId);
    if (!access) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found");
    if (access.createdByUserId !== userId) await this.communities.requireCoach(access.communityId, userId);
    return access;
  }
}
