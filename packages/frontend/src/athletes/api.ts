import type {
  AthletesCalendarCreateInput,
  AthletesCalendarEntry,
  AthletesCalendarListView,
  AthletesCalendarRsvpInput,
  AthletesCalendarRsvpResult,
  AthletesCalendarUpdateInput,
  AthletesCommunityCreateInput,
  AthletesCommunityWriteResult,
  AthletesCommunityUpdateInput,
  AthletesJoinRequest,
  AthletesJoinRequestPage,
  AthletesJoinResult,
  AthletesMemberPage,
  AthletesPhotoContentType,
  AthletesPhotoDelivery,
  AthletesPhotoList,
  AthletesPhotoUploadResponse,
  AthletesPublicDetail,
  AthletesPublicSummary,
  AthletesSport,
} from "@hooma/contracts/athletes";
import { request, requestBinary, HoomaApiError, type HoomaTransport } from "../http";
type PublicAthletesSummary = AthletesPublicSummary;
type PublicAthletesDetail = AthletesPublicDetail;
type PublicAthletesList = { items: PublicAthletesSummary[]; nextCursor: string | null };

function athletesPublicListPath(
  filters: { sport?: AthletesSport; cursor?: string; limit?: number } = {},
): string {
  const params = new URLSearchParams();
  if (filters.sport) params.set("sport", filters.sport);
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 30));
  return `/api/public/v1/athletes?${params.toString()}`;
}

function calendarListPath(id: string, from: string, to: string): string {
  const params = new URLSearchParams({ from, to });
  return `/api/v1/athletes/${encodeURIComponent(id)}/calendar?${params.toString()}`;
}

function privatePagePath(
  id: string,
  resource: "members" | "join-requests",
  cursor?: string,
): string {
  const params = new URLSearchParams({ limit: "50" });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/athletes/${encodeURIComponent(id)}/${resource}?${params.toString()}`;
}

export function createAthletesApi(transport: HoomaTransport) {
  return {
    publicList: (filters?: { sport?: AthletesSport; cursor?: string; limit?: number }) =>
      request<PublicAthletesList>(transport, athletesPublicListPath(filters)),
    publicDetail: (id: string) =>
      request<PublicAthletesDetail>(transport, `/api/public/v1/athletes/${encodeURIComponent(id)}`),
    detail: async (id: string) => {
      try {
        return await request<PublicAthletesDetail>(
          transport,
          `/api/v1/athletes/${encodeURIComponent(id)}`,
        );
      } catch (error) {
        if (error instanceof HoomaApiError && error.status === 401) {
          return request<PublicAthletesDetail>(
            transport,
            `/api/public/v1/athletes/${encodeURIComponent(id)}`,
          );
        }
        throw error;
      }
    },
    create: (input: AthletesCommunityCreateInput) =>
      request<AthletesCommunityWriteResult>(transport, "/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: AthletesCommunityUpdateInput) =>
      request<AthletesCommunityWriteResult>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    archive: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/athletes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    join: (id: string) =>
      request<AthletesJoinResult>(transport, `/api/v1/athletes/${encodeURIComponent(id)}/join`, {
        method: "POST",
      }),
    myJoinRequest: (id: string) =>
      request<{ request: AthletesJoinRequest | null }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-request`,
      ),
    cancelJoinRequest: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/athletes/${encodeURIComponent(id)}/join-request`, {
        method: "DELETE",
      }),
    joinRequests: (id: string, cursor?: string) =>
      request<AthletesJoinRequestPage>(transport, privatePagePath(id, "join-requests", cursor)),
    approveJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/approve`,
        { method: "POST" },
      ),
    declineJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/decline`,
        { method: "POST" },
      ),
    members: (id: string, cursor?: string) =>
      request<AthletesMemberPage>(transport, privatePagePath(id, "members", cursor)),
    addMember: (id: string, username: string) =>
      request<{ member: { userId: string; username: string } }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members`,
        { method: "POST", body: JSON.stringify({ username }) },
      ),
    removeMember: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    setMemberRole: (id: string, userId: string, role: "MODERATOR" | "MEMBER") =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) },
      ),
    listCalendar: (id: string, from: string, to: string) =>
      request<AthletesCalendarListView>(transport, calendarListPath(id, from, to)),
    createCalendarEntry: (id: string, input: AthletesCalendarCreateInput) =>
      request<AthletesCalendarEntry>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/calendar`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    updateCalendarEntry: (id: string, entryId: string, input: AthletesCalendarUpdateInput) =>
      request<AthletesCalendarEntry>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/calendar/${encodeURIComponent(entryId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    cancelCalendarEntry: (id: string, entryId: string) =>
      request<AthletesCalendarEntry>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/calendar/${encodeURIComponent(entryId)}/cancel`,
        { method: "POST" },
      ),
    setCalendarRsvp: (id: string, entryId: string, input: AthletesCalendarRsvpInput) =>
      request<AthletesCalendarRsvpResult>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/calendar/${encodeURIComponent(entryId)}/rsvp`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    listPhotos: (id: string, cursor?: string) =>
      request<AthletesPhotoList>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/photos${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
    uploadPhoto: (id: string, body: Blob, contentType: AthletesPhotoContentType) =>
      requestBinary<AthletesPhotoUploadResponse>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/photos`,
        body,
        contentType,
        { method: "POST" },
      ),
    deletePhoto: (id: string, photoId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
        { method: "DELETE" },
      ),
    photoDelivery: (id: string, photoId: string, signal?: AbortSignal) =>
      request<AthletesPhotoDelivery>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}/delivery`,
        signal ? { signal } : undefined,
      ),
  };
}
