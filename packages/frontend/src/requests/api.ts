import type {
  HelpRequest,
  HelpRequestCreateInput,
  HelpRequestList,
  HelpRequestListQuery,
  HelpRequestRespondInput,
  HelpRequestResponse,
  HelpRequestResponseList,
} from "@hooma/contracts/requests";
import { request, type HoomaTransport } from "../http";

function queryPath(base: string, input: HelpRequestListQuery = {}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.category) params.set("category", input.category);
  if (input.sport) params.set("sport", input.sport);
  if (input.city) params.set("city", input.city);
  if (input.houma) params.set("houma", input.houma);
  if (input.status) params.set("status", input.status);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function createRequestsApi(transport: HoomaTransport) {
  const memberBase = "/api/v1/requests";
  const publicBase = "/api/public/v1/requests";

  return {
    publicList: (input?: HelpRequestListQuery) =>
      request<HelpRequestList>(transport, queryPath(publicBase, input)),
    publicDetail: (requestId: string) =>
      request<HelpRequest>(transport, `${publicBase}/${encodeURIComponent(requestId)}`),
    memberList: (input?: HelpRequestListQuery) =>
      request<HelpRequestList>(transport, queryPath(memberBase, input)),
    memberDetail: (requestId: string) =>
      request<HelpRequest>(transport, `${memberBase}/${encodeURIComponent(requestId)}`),
    create: (input: HelpRequestCreateInput) =>
      request<HelpRequest>(transport, memberBase, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    respond: (requestId: string, input: HelpRequestRespondInput) =>
      request<HelpRequestResponse>(transport, `${memberBase}/${encodeURIComponent(requestId)}/responses`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    responses: (requestId: string) =>
      request<HelpRequestResponseList>(
        transport,
        `${memberBase}/${encodeURIComponent(requestId)}/responses`,
      ),
    acceptResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(
        transport,
        `${memberBase}/${encodeURIComponent(requestId)}/responses/${encodeURIComponent(responseId)}/accept`,
        { method: "POST" },
      ),
    declineResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(
        transport,
        `${memberBase}/${encodeURIComponent(requestId)}/responses/${encodeURIComponent(responseId)}/decline`,
        { method: "POST" },
      ),
    withdrawResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(
        transport,
        `${memberBase}/${encodeURIComponent(requestId)}/responses/${encodeURIComponent(responseId)}/withdraw`,
        { method: "POST" },
      ),
    fulfill: (requestId: string) =>
      request<HelpRequest>(transport, `${memberBase}/${encodeURIComponent(requestId)}/fulfill`, {
        method: "POST",
      }),
    cancel: (requestId: string) =>
      request<HelpRequest>(transport, `${memberBase}/${encodeURIComponent(requestId)}/cancel`, {
        method: "POST",
      }),
  };
}

export type RequestsApi = ReturnType<typeof createRequestsApi>;
