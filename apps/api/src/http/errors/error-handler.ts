import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { EventError, type EventErrorCode } from "../../modules/events/domain/event-error.js";
import { RideError, type RideErrorCode } from "../../modules/rides/domain/ride-error.js";
import { AppError } from "./app-error.js";

const EVENT_STATUS: Record<EventErrorCode, number> = {
  EVENT_NOT_FOUND: 404,
  COMMUNITY_REQUIRED: 400,
  PLACE_REQUIRED: 400,
  EVENT_MANAGE_FORBIDDEN: 403,
  EVENT_PAYMENTS_NOT_ENABLED: 409,
  EVENT_NOT_EDITABLE: 409,
  EVENT_TIME_INVALID: 400,
  WATCH_CULTURAL_OWNER_REQUIRED: 403,
  WATCH_EVENT_KIND_IMMUTABLE: 409,
  EVENT_NOT_CANCELLABLE: 409,
  EVENT_NOT_COMPLETABLE: 409,
  EVENT_FULL: 409,
  EVENT_NOT_ACTIVE: 409,
  EVENT_INVITE_NOT_AVAILABLE: 409,
  EVENT_INVITE_SELF: 409,
  EVENT_INVITE_ALREADY_JOINED: 409,
  EVENT_INVITE_NOT_FOUND: 404,
  EVENT_INVITE_CLOSED: 409,
  RSVP_ALREADY_ATTENDED: 409,
  EVENT_MEMBER_CONTENT_FORBIDDEN: 403,
  EVENT_FORMATION_INVALID_PLAYER: 400,
  EVENT_FORMATION_DUPLICATE_PLAYER: 400,
  EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP: 403,
  EVENT_CHAT_FORBIDDEN: 403,
  EVENT_CHAT_INACTIVE: 409,
};

const RIDE_STATUS: Record<RideErrorCode, number> = {
  RIDE_DESTINATION_REQUIRED: 400,
  RIDE_DESTINATION_STRATEGY_CONFLICT: 400,
  RIDE_DRIVER_CANNOT_PARTICIPATE: 409,
  RIDE_OFFER_STATUS_TRANSITION_INVALID: 409,
  RIDE_REQUEST_STATUS_TRANSITION_INVALID: 409,
  RIDE_PARTICIPATION_STATUS_TRANSITION_INVALID: 409,
  RIDE_OFFER_NOT_FOUND: 404,
  RIDE_OFFER_NOT_MUTABLE: 409,
  RIDE_REQUEST_NOT_FOUND: 404,
  RIDE_REQUEST_NOT_MUTABLE: 409,
  RIDE_PARTICIPATION_NOT_AVAILABLE: 409,
  RIDE_PARTICIPATION_CANCEL_FORBIDDEN: 403,
  RIDE_MEETING_POINT_NOT_AVAILABLE: 409,
  RIDE_MEETING_POINT_FORBIDDEN: 403,
  RIDE_OFFER_STATUS_NOT_CHANGED: 409,
  RIDE_REQUEST_STATUS_NOT_CHANGED: 409,
  RIDE_PARTICIPATION_STATUS_NOT_CHANGED: 409,
  RIDE_OFFER_MANAGE_FORBIDDEN: 403,
  RIDE_REQUEST_MANAGE_FORBIDDEN: 403,
  RIDE_DESTINATION_EVENT_NOT_FOUND: 404,
  RIDE_DESTINATION_PLACE_NOT_FOUND: 404,
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  if (error instanceof EventError) {
    response
      .status(EVENT_STATUS[error.code])
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof RideError) {
    response
      .status(RIDE_STATUS[error.code])
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: error.issues,
      },
    });
    return;
  }
  console.error(error);
  response
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
};
