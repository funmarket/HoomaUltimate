import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import {
  eventChatMessageSchema,
  eventCheckInSchema,
  eventCreateSchema,
  eventFormationSchema,
  eventUpdateSchema,
} from "@hooma/contracts";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../../identity/application/identity.service.js";
import { getAuth } from "../../identity/http/auth-request.js";
import { resolveAuthentication } from "../../identity/http/auth.middleware.js";
import type { EventService } from "../application/event.service.js";

function numberQuery(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createEventPublicRouter(
  service: EventService,
  identity: IdentityService,
  config: ApiConfig,
): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (request, response) => {
      const type =
        request.query.type === "PLAY" || request.query.type === "WATCH"
          ? request.query.type
          : undefined;
      const communityId =
        typeof request.query.communityId === "string" ? request.query.communityId : undefined;
      const placeId = typeof request.query.placeId === "string" ? request.query.placeId : undefined;
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
      const from =
        typeof request.query.from === "string" ? new Date(request.query.from) : undefined;
      const auth = await resolveAuthentication(request, identity, config);
      response.json(
        await service.listPublic({
          limit: numberQuery(request.query.limit, 30),
          ...(type !== undefined ? { type } : {}),
          ...(communityId !== undefined ? { communityId } : {}),
          ...(placeId !== undefined ? { placeId } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(from !== undefined ? { from } : {}),
          ...(auth ? { viewerUserId: auth.userId } : {}),
        }),
      );
    }),
  );
  router.get(
    "/:eventId",
    asyncHandler(async (request, response) => {
      const auth = await resolveAuthentication(request, identity, config);
      response.json(
        await service.getVisible(String(request.params.eventId), auth?.userId),
      );
    }),
  );
  return router;
}

export function createEventMemberRouter(service: EventService): Router {
  const router = Router();
  router.post(
    "/",
    asyncHandler(async (request, response) =>
      response
        .status(201)
        .json(await service.create(getAuth(request).userId, eventCreateSchema.parse(request.body))),
    ),
  );
  router.get(
    "/invitations/incoming",
    asyncHandler(async (request, response) =>
      response.json(await service.incomingPlayerInvites(getAuth(request).userId)),
    ),
  );
  router.post(
    "/invitations/:inviteId/accept",
    asyncHandler(async (request, response) =>
      response.json(
        await service.acceptPlayerInvite(getAuth(request).userId, String(request.params.inviteId)),
      ),
    ),
  );
  router.post(
    "/invitations/:inviteId/decline",
    asyncHandler(async (request, response) =>
      response.json(
        await service.declinePlayerInvite(getAuth(request).userId, String(request.params.inviteId)),
      ),
    ),
  );
  router.get(
    "/:eventId/manage",
    asyncHandler(async (request, response) =>
      response.json(
        await service.getManaged(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.patch(
    "/:eventId",
    asyncHandler(async (request, response) =>
      response.json(
        await service.update(
          getAuth(request).userId,
          String(request.params.eventId),
          eventUpdateSchema.parse(request.body),
        ),
      ),
    ),
  );
  router.get(
    "/:eventId/rsvp",
    asyncHandler(async (request, response) =>
      response.json(
        await service.getMyRsvp(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.get(
    "/:eventId/formation-roster",
    asyncHandler(async (request, response) =>
      response.json(
        await service.formationRoster(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.post(
    "/:eventId/join",
    asyncHandler(async (request, response) =>
      response.json(await service.join(getAuth(request).userId, String(request.params.eventId))),
    ),
  );
  router.delete(
    "/:eventId/rsvp",
    asyncHandler(async (request, response) =>
      response.json(
        await service.cancelRsvp(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.post(
    "/:eventId/cancel",
    asyncHandler(async (request, response) =>
      response.json(await service.cancel(getAuth(request).userId, String(request.params.eventId))),
    ),
  );
  router.post(
    "/:eventId/complete",
    asyncHandler(async (request, response) =>
      response.json(
        await service.complete(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.get(
    "/:eventId/formations",
    asyncHandler(async (request, response) =>
      response.json(
        await service.listFormations(getAuth(request).userId, String(request.params.eventId)),
      ),
    ),
  );
  router.post(
    "/:eventId/formations",
    asyncHandler(async (request, response) =>
      response
        .status(201)
        .json(
          await service.createFormation(
            getAuth(request).userId,
            String(request.params.eventId),
            eventFormationSchema.parse(request.body),
          ),
        ),
    ),
  );
  router.post(
    "/:eventId/check-in",
    asyncHandler(async (request, response) => {
      const input = eventCheckInSchema.parse(request.body ?? {});
      response.json(
        await service.checkIn(
          getAuth(request).userId,
          String(request.params.eventId),
          input.latitude,
          input.longitude,
        ),
      );
    }),
  );
  router.get(
    "/:eventId/chat",
    asyncHandler(async (request, response) =>
      response.json(await service.chat(getAuth(request).userId, String(request.params.eventId))),
    ),
  );
  router.post(
    "/:eventId/chat/messages",
    asyncHandler(async (request, response) => {
      const input = eventChatMessageSchema.parse(request.body);
      response
        .status(201)
        .json(
          await service.postChat(
            getAuth(request).userId,
            String(request.params.eventId),
            input.body,
          ),
        );
    }),
  );
  return router;
}
