import { RequestError } from "../domain/request-error.js";
import type {
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "./request.repository.js";

export async function canManageRequest(
  visibility: RequestVisibilityReader,
  userId: string,
  request: HelpRequestRecord,
): Promise<boolean> {
  if (request.publisherCommunityId) {
    const role = await visibility.communityRole(request.publisherCommunityId, userId);
    return role === "FOUNDER" || role === "COACH";
  }
  if (request.publisherTeamId) {
    return (await visibility.teamResponsibility(request.publisherTeamId, userId)) === "COACH";
  }
  if (request.publisherAthletesCommunityId) {
    const role = await visibility.athletesRole(request.publisherAthletesCommunityId, userId);
    return role === "FOUNDER" || role === "MODERATOR";
  }
  return request.createdByUserId === userId;
}

export async function requireManageRequest(
  repository: RequestRepository,
  visibility: RequestVisibilityReader,
  userId: string,
  requestId: string,
): Promise<HelpRequestRecord> {
  const request = await repository.getById(requestId);
  if (!request || !(await canManageRequest(visibility, userId, request))) {
    throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
  }
  return request;
}
