import {
  athletesCalendarEntryCreateSchema,
  athletesCalendarEntryUpdateSchema,
  athletesCalendarRangeSchema,
} from "@hooma/contracts/athletes-calendar";
import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { AthletesCalendarService } from "../application/athletes-calendar.service.js";

export function createAthletesCalendarRouter(service: AthletesCalendarService): Router {
  const router = Router();

  router.get(
    "/:athletesCommunityId/calendar",
    asyncHandler(async (req, res) => {
      const range = athletesCalendarRangeSchema.parse(req.query);
      res.setHeader("cache-control", "private, no-store");
      res.json(
        await service.list(getAuth(req).userId, String(req.params.athletesCommunityId), range),
      );
    }),
  );

  router.post(
    "/:athletesCommunityId/calendar",
    asyncHandler(async (req, res) => {
      res
        .status(201)
        .json(
          await service.create(
            getAuth(req).userId,
            String(req.params.athletesCommunityId),
            athletesCalendarEntryCreateSchema.parse(req.body),
          ),
        );
    }),
  );

  router.put(
    "/:athletesCommunityId/calendar/:entryId",
    asyncHandler(async (req, res) => {
      res.json(
        await service.update(
          getAuth(req).userId,
          String(req.params.athletesCommunityId),
          String(req.params.entryId),
          athletesCalendarEntryUpdateSchema.parse(req.body),
        ),
      );
    }),
  );

  router.delete(
    "/:athletesCommunityId/calendar/:entryId",
    asyncHandler(async (req, res) => {
      res.json(
        await service.cancel(
          getAuth(req).userId,
          String(req.params.athletesCommunityId),
          String(req.params.entryId),
        ),
      );
    }),
  );

  return router;
}
