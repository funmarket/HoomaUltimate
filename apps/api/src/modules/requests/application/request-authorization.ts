import { RequestError } from "../domain/request-error.js";
import type { HelpAccessReader } from "../../help/application/help-access.reader.js";
import type { HelpRequestRecord, RequestRepository } from "./request.repository.js";

export async function canManageRequest(
  visibility: HelpAccessReader,
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
  visibility: HelpAccessReader,
  userId: string,
  requestId: string,
): Promise<HelpRequestRecord> {
  const request = await repository.getById(requestId);
  if (!request || !(await canManageRequest(visibility, userId, request))) {
    throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
  }
  return request;
}
