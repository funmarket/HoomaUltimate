import { Router } from "express";
import { helpTaxonomyQuerySchema } from "@hooma/contracts/help-taxonomy";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { HelpTaxonomyService } from "../application/help-taxonomy.service.js";

export function createHelpTaxonomyPublicRouter(service: HelpTaxonomyService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(await service.list(helpTaxonomyQuerySchema.parse(request.query)));
    }),
  );

  return router;
}
