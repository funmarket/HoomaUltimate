import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
} from "@hooma/contracts/athletes-calendar";
import { request, type HoomaTransport } from "../../http";

function calendarPath(athletesCommunityId: string): string {
  return `/api/v1/athletes/${encodeURIComponent(athletesCommunityId)}/calendar`;
}

export function createAthletesCalendarApi(transport: HoomaTransport) {
  return {
    list: (athletesCommunityId: string, from: string, to: string) => {
      const params = new URLSearchParams({ from, to });
      return request<AthletesCalendarEntry[]>(
        transport,
        `${calendarPath(athletesCommunityId)}?${params.toString()}`,
      );
    },
    create: (athletesCommunityId: string, input: AthletesCalendarEntryCreateInput) =>
      request<AthletesCalendarEntry>(transport, calendarPath(athletesCommunityId), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (
      athletesCommunityId: string,
      entryId: string,
      input: AthletesCalendarEntryUpdateInput,
    ) =>
      request<AthletesCalendarEntry>(
        transport,
        `${calendarPath(athletesCommunityId)}/${encodeURIComponent(entryId)}`,
        { method: "PUT", body: JSON.stringify(input) },
      ),
    cancel: (athletesCommunityId: string, entryId: string) =>
      request<AthletesCalendarEntry>(
        transport,
        `${calendarPath(athletesCommunityId)}/${encodeURIComponent(entryId)}`,
        { method: "DELETE" },
      ),
  };
}
