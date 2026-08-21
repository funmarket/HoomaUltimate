import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { requireAuthentication } from "../../modules/identity/http/auth.middleware.js";
import { createIdentityMemberRouter } from "../../modules/identity/http/identity.member.routes.js";
import { createPlatformAdminRouter } from "../../modules/platform-admin/http/platform-admin.routes.js";
import { createCommunityMemberRouter } from "../../modules/communities/http/community.routes.js";
import { createTeamMemberRouter } from "../../modules/teams/http/team.routes.js";

export function createMemberV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use(requireAuthentication(container.identityService, config));
  router.use(createIdentityMemberRouter(container.identityService, config));
  router.use("/admin", createPlatformAdminRouter(container.platformAdminService));
  router.use("/communities", createCommunityMemberRouter(container.communityService));
  router.use("/teams", createTeamMemberRouter(container.teamService));
  return router;
}
