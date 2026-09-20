import { Router } from "express";
import {
  passwordRecoveryConfirmSchema,
  passwordRecoveryRequestSchema,
} from "@hooma/contracts";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { PasswordRecoveryService } from "../application/password-recovery.service.js";

export function createPasswordRecoveryPublicRouter(service: PasswordRecoveryService): Router {
  const router = Router();

  router.post(
    "/request",
    asyncHandler(async (request, response) => {
      await service.request(passwordRecoveryRequestSchema.parse(request.body));
      response.status(202).json({ ok: true });
    }),
  );

  router.post(
    "/confirm",
    asyncHandler(async (request, response) => {
      response.json(await service.confirm(passwordRecoveryConfirmSchema.parse(request.body)));
    }),
  );

  return router;
}
