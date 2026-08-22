export type EventErrorCode =
  | "EVENT_NOT_FOUND"
  | "WATCH_NOT_ENABLED"
  | "EVENT_PAYMENTS_NOT_ENABLED"
  | "EVENT_NOT_EDITABLE"
  | "EVENT_TIME_INVALID"
  | "EVENT_NOT_CANCELLABLE"
  | "EVENT_NOT_COMPLETABLE"
  | "EVENT_FULL"
  | "EVENT_NOT_ACTIVE"
  | "RSVP_ALREADY_ATTENDED"
  | "EVENT_MEMBER_CONTENT_FORBIDDEN"
  | "EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP"
  | "EVENT_CHAT_FORBIDDEN"
  | "EVENT_CHAT_INACTIVE";

export class EventError extends Error {
  constructor(
    public readonly code: EventErrorCode,
    message: string
  ) {
    super(message);
    this.name = "EventError";
  }
}
