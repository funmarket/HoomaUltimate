import type { HelpTaxonomyResponse, HelpTaxonomySurface } from "@hooma/contracts/help-taxonomy";
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

const MEMBER_BASE = "/api/v1/requests";
const PUBLIC_BASE = "/api/public/v1/requests";

/**
 * Outgoing list filters. The API contract resolves `limit` from its own default,
 * so the frontend sends only the filters the caller actually chose.
 */
export type RequestsListQuery = Partial<HelpRequestListQuery>;

function queryPath(base: string, input: RequestsListQuery = {}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.category) params.set("category", input.category);
  if (input.requestType) params.set("requestType", input.requestType);
  if (input.sport) params.set("sport", input.sport);
  if (input.subcategoryId) params.set("subcategoryId", input.subcategoryId);
  if (input.needId) params.set("needId", input.needId);
  if (input.surface) params.set("surface", input.surface);
  if (input.city) params.set("city", input.city);
  if (input.houma) params.set("houma", input.houma);
  if (input.status) params.set("status", input.status);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function responsePath(requestId: string, responseId?: string): string {
  const base = `${MEMBER_BASE}/${encodeURIComponent(requestId)}/responses`;
  return responseId ? `${base}/${encodeURIComponent(responseId)}` : base;
}

/**
 * Single HTTP boundary for HOOMA Requests.
 *
 * Endpoint family and shapes mirror apps/api/src/modules/requests/http/request.routes.ts
 * exactly; the backend stays authoritative for visibility, authorization, response
 * privacy and lifecycle transitions. UI code must never fetch these routes directly.
 */
export function createRequestsApi(transport: HoomaTransport) {
  return {
    taxonomy: (surface: HelpTaxonomySurface) =>
      request<HelpTaxonomyResponse>(
        transport,
        `/api/public/v1/help/taxonomy?surface=${encodeURIComponent(surface)}`,
      ),
    publicList: (input?: RequestsListQuery) =>
      request<HelpRequestList>(transport, queryPath(PUBLIC_BASE, input)),
    publicDetail: (requestId: string) =>
      request<HelpRequest>(transport, `${PUBLIC_BASE}/${encodeURIComponent(requestId)}`),
    memberList: (input?: RequestsListQuery) =>
      request<HelpRequestList>(transport, queryPath(MEMBER_BASE, input)),
    memberDetail: (requestId: string) =>
      request<HelpRequest>(transport, `${MEMBER_BASE}/${encodeURIComponent(requestId)}`),
    create: (input: HelpRequestCreateInput) =>
      request<HelpRequest>(transport, MEMBER_BASE, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    respond: (requestId: string, input: HelpRequestRespondInput) =>
      request<HelpRequestResponse>(transport, responsePath(requestId), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    responses: (requestId: string) =>
      request<HelpRequestResponseList>(transport, responsePath(requestId)),
    acceptResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(transport, `${responsePath(requestId, responseId)}/accept`, {
        method: "POST",
      }),
    declineResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(transport, `${responsePath(requestId, responseId)}/decline`, {
        method: "POST",
      }),
    withdrawResponse: (requestId: string, responseId: string) =>
      request<HelpRequestResponse>(transport, `${responsePath(requestId, responseId)}/withdraw`, {
        method: "POST",
      }),
    fulfill: (requestId: string) =>
      request<HelpRequest>(transport, `${MEMBER_BASE}/${encodeURIComponent(requestId)}/fulfill`, {
        method: "POST",
      }),
    cancel: (requestId: string) =>
      request<HelpRequest>(transport, `${MEMBER_BASE}/${encodeURIComponent(requestId)}/cancel`, {
        method: "POST",
      }),
  };
}

export type RequestsApi = ReturnType<typeof createRequestsApi>;
