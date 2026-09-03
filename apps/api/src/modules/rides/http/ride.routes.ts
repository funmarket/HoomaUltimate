import { Buffer } from "node:buffer";
import { Router, raw } from "express";
import {
  rideMeetingPointInputSchema,
  rideContextSchema,
  rideMineQuerySchema,
  rideOfferCreateSchema,
  rideOfferUpdateSchema,
  rideParticipationRequestSchema,
  rideRequestCreateSchema,
  rideRequestUpdateSchema,
} from "@hooma/contracts/rides";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { RideService } from "../application/ride.service.js";

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function dateQuery(value: unknown): Date | undefined {
  return typeof value === "string" && value.trim() ? new Date(value) : undefined;
}

interface RideListQueryInput {
  readonly limit: number;
  readonly cursor?: string;
  readonly context?: "MATCHDAY" | "GENERAL";
  readonly eventId?: string;
  readonly destinationPlaceId?: string;
  readonly from?: Date;
}

function listQuery(query: {
  readonly limit?: unknown;
  readonly cursor?: unknown;
  readonly context?: unknown;
  readonly eventId?: unknown;
  readonly destinationPlaceId?: unknown;
  readonly from?: unknown;
}): RideListQueryInput {
  const input: RideListQueryInput = { limit: numberQuery(query.limit, 20) };
  const cursor = stringQuery(query.cursor);
  const context = stringQuery(query.context);
  const eventId = stringQuery(query.eventId);
  const destinationPlaceId = stringQuery(query.destinationPlaceId);
  const from = dateQuery(query.from);

  return {
    ...input,
    ...(cursor !== undefined ? { cursor } : {}),
    ...(context !== undefined ? { context: rideContextSchema.parse(context) } : {}),
    ...(eventId !== undefined ? { eventId } : {}),
    ...(destinationPlaceId !== undefined ? { destinationPlaceId } : {}),
    ...(from !== undefined ? { from } : {}),
  };
}

export function createRidePublicRouter(service: RideService): Router {
  const router = Router();

  router.get(
    "/offers",
    asyncHandler(async (request, response) => {
      response.json(await service.listPublicOffers(listQuery(request.query)));
    }),
  );

  router.get(
    "/offers/:offerId/photo",
    asyncHandler(async (request, response) => {
      const photo = await service.getPublicOfferVehiclePhoto(String(request.params.offerId));
      response
        .type(photo.contentType)
        .set("content-length", String(photo.sizeBytes))
        .send(Buffer.from(photo.body));
    }),
  );

  router.get(
    "/offers/:offerId/map",
    asyncHandler(async (request, response) => {
      response
        .set("cache-control", "public, max-age=300, stale-while-revalidate=300")
        .type("image/svg+xml")
        .send(await service.getPublicOfferMapPreview(String(request.params.offerId)));
    }),
  );

  router.get(
    "/offers/:offerId",
    asyncHandler(async (request, response) => {
      response.json(await service.getPublicOffer(String(request.params.offerId)));
    }),
  );

  router.get(
    "/requests",
    asyncHandler(async (request, response) => {
      response.json(await service.listPublicRequests(listQuery(request.query)));
    }),
  );

  router.get(
    "/requests/:requestId",
    asyncHandler(async (request, response) => {
      response.json(await service.getPublicRequest(String(request.params.requestId)));
    }),
  );

  return router;
}

export function createRideMemberRouter(service: RideService): Router {
  const router = Router();

  router.get(
    "/mine",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getMyRides(getAuth(request).userId, rideMineQuerySchema.parse(request.query)),
      );
    }),
  );

  router.post(
    "/offers",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createOffer(
            getAuth(request).userId,
            rideOfferCreateSchema.parse(request.body),
          ),
        );
    }),
  );

  router.get(
    "/offers/:offerId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getMyOffer(getAuth(request).userId, String(request.params.offerId)),
      );
    }),
  );

  router.patch(
    "/offers/:offerId",
    asyncHandler(async (request, response) => {
      response.json(
        await service.updateOffer(
          getAuth(request).userId,
          String(request.params.offerId),
          rideOfferUpdateSchema.parse(request.body),
        ),
      );
    }),
  );

  router.post(
    "/offers/:offerId/cancel",
    asyncHandler(async (request, response) => {
      response.json(
        await service.cancelOffer(getAuth(request).userId, String(request.params.offerId)),
      );
    }),
  );

  router.put(
    "/offers/:offerId/photo",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? new Uint8Array(request.body) : new Uint8Array();
      response.json(
        await service.replaceOfferVehiclePhoto(
          getAuth(request).userId,
          String(request.params.offerId),
          {
            contentType: request.header("content-type") ?? "application/octet-stream",
            body,
          },
        ),
      );
    }),
  );

  router.delete(
    "/offers/:offerId/photo",
    asyncHandler(async (request, response) => {
      await service.deleteOfferVehiclePhoto(
        getAuth(request).userId,
        String(request.params.offerId),
      );
      response.status(204).end();
    }),
  );

  router.post(
    "/offers/:offerId/participations",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.requestParticipation(
            getAuth(request).userId,
            String(request.params.offerId),
            rideParticipationRequestSchema.parse(request.body),
          ),
        );
    }),
  );

  router.get(
    "/offers/:offerId/participations/me",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getMyParticipation(getAuth(request).userId, String(request.params.offerId)),
      );
    }),
  );

  router.post(
    "/offers/:offerId/participations/:participationId/accept",
    asyncHandler(async (request, response) => {
      response.json(
        await service.acceptParticipation(
          getAuth(request).userId,
          String(request.params.offerId),
          String(request.params.participationId),
        ),
      );
    }),
  );

  router.post(
    "/offers/:offerId/participations/:participationId/reject",
    asyncHandler(async (request, response) => {
      response.json(
        await service.rejectParticipation(
          getAuth(request).userId,
          String(request.params.offerId),
          String(request.params.participationId),
        ),
      );
    }),
  );

  router.post(
    "/offers/:offerId/participations/:participationId/cancel",
    asyncHandler(async (request, response) => {
      response.json(
        await service.cancelParticipation(
          getAuth(request).userId,
          String(request.params.offerId),
          String(request.params.participationId),
        ),
      );
    }),
  );

  router.put(
    "/offers/:offerId/participations/:participationId/meeting-point",
    asyncHandler(async (request, response) => {
      response.json(
        await service.upsertMeetingPoint(
          getAuth(request).userId,
          String(request.params.offerId),
          String(request.params.participationId),
          rideMeetingPointInputSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/participations/:participationId/meeting-point",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getMeetingPoint(
          getAuth(request).userId,
          String(request.params.participationId),
        ),
      );
    }),
  );

  router.get(
    "/participations/:participationId/meeting-point/map",
    asyncHandler(async (request, response) => {
      response
        .set("cache-control", "private, no-store")
        .type("image/svg+xml")
        .send(
          await service.getMeetingPointMapPreview(
            getAuth(request).userId,
            String(request.params.participationId),
          ),
        );
    }),
  );

  router.post(
    "/requests",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createRequest(
            getAuth(request).userId,
            rideRequestCreateSchema.parse(request.body),
          ),
        );
    }),
  );

  router.get(
    "/communities/:communityId/requests",
    asyncHandler(async (request, response) => {
      response.json(
        await service.listCommunityRequests(
          getAuth(request).userId,
          String(request.params.communityId),
          listQuery(request.query),
        ),
      );
    }),
  );

  router.get(
    "/requests/:requestId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getMyRequest(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  router.patch(
    "/requests/:requestId",
    asyncHandler(async (request, response) => {
      response.json(
        await service.updateRequest(
          getAuth(request).userId,
          String(request.params.requestId),
          rideRequestUpdateSchema.parse(request.body),
        ),
      );
    }),
  );

  router.post(
    "/requests/:requestId/cancel",
    asyncHandler(async (request, response) => {
      response.json(
        await service.cancelRequest(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  return router;
}
