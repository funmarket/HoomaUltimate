import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { helpRequestResponseSchema } from "@hooma/contracts/requests";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import type {
  HelpRequestRecord,
  HelpRequestResponseRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

function requestRecord(): HelpRequestRecord {
  return {
    id: "request-1",
    createdByUserId: "owner-1",
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    category: "ITEM",
    itemKind: "FOOTWEAR",
    sport: "RUNNING",
    title: "Need boots",
    description: "Need football boots for training this weekend.",
    quantityNeeded: 1,
    sizeLabel: "43",
    conditionPreference: "USED_OK",
    placeId: null,
    city: "Tunis",
    houma: null,
    locationNote: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-21T12:00:00.000Z"),
    updatedAt: new Date("2026-09-21T12:00:00.000Z"),
  };
}

function responseRecord(
  overrides: Partial<HelpRequestResponseRecord> = {},
): HelpRequestResponseRecord {
  return {
    id: "response-1",
    requestId: "request-1",
    responderUserId: "helper-1",
    message: "I can help.",
    status: "PENDING",
    createdAt: new Date("2026-09-21T12:05:00.000Z"),
    updatedAt: new Date("2026-09-21T12:05:00.000Z"),
    acceptedAt: null,
    declinedAt: null,
    withdrawnAt: null,
    ...overrides,
  };
}

function repository(): RequestRepository {
  return {
    async create() {
      return requestRecord();
    },
    async listPublic() {
      return { items: [requestRecord()], nextCursor: null };
    },
    async getPublic() {
      return requestRecord();
    },
    async listVisibleToMember() {
      return { items: [requestRecord()], nextCursor: null };
    },
    async getVisibleToMember() {
      return requestRecord();
    },
    async getById() {
      return requestRecord();
    },
    async createResponse() {
      return responseRecord();
    },
    async listResponses() {
      return [responseRecord()];
    },
    async getResponseById() {
      return responseRecord();
    },
    async getResponseByResponder() {
      return responseRecord();
    },
    async acceptResponse() {
      return responseRecord({ status: "ACCEPTED" });
    },
    async declineResponse() {
      return responseRecord({ status: "DECLINED" });
    },
    async withdrawResponse() {
      return responseRecord({ status: "WITHDRAWN" });
    },
    async transitionRequestStatus() {
      return requestRecord();
    },
    async expireDue() {
      return 0;
    },
  };
}

function visibility(): RequestVisibilityReader {
  return {
    async communityRole() {
      return null;
    },
    async teamResponsibility() {
      return null;
    },
    async athletesRole() {
      return null;
    },
    async isCommunityMember() {
      return false;
    },
    async isAthletesMember() {
      return false;
    },
  };
}

test("Request responses project only safe responder presentation fields", async () => {
  const service = new RequestService(repository(), visibility(), {
    async findByUserIds() {
      return [
        {
          userId: "helper-1",
          displayName: "Helper One",
          username: "helper",
          photoUrl: "https://cdn.example/helper.jpg",
        },
      ];
    },
  });

  const result = await service.listResponses("owner-1", "request-1");
  assert.deepEqual(result.items[0]?.responder, {
    displayName: "Helper One",
    username: "helper",
    photoUrl: "https://cdn.example/helper.jpg",
  });
  assert.equal("phone" in (result.items[0]?.responder ?? {}), false);
  assert.deepEqual(helpRequestResponseSchema.parse(result.items[0]), result.items[0]);
});

function installDom(url = "http://localhost/requests") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    FormData: dom.window.FormData,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLInputElement: dom.window.HTMLInputElement,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const requestOne = {
  id: "request-1",
  createdByUserId: "owner-1",
  publisherCommunityId: null,
  publisherTeamId: null,
  publisherAthletesCommunityId: null,
  audienceScope: "PUBLIC",
  audienceCommunityId: null,
  audienceAthletesCommunityId: null,
  category: "ITEM",
  itemKind: "FOOTWEAR",
  sport: "RUNNING",
  title: "Need boots",
  description: "Need football boots for training this weekend.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK",
  placeId: null,
  city: "Tunis",
  houma: null,
  locationNote: null,
  neededByAt: null,
  expiresAt: null,
  status: "OPEN",
  fulfilledAt: null,
  cancelledAt: null,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z",
};

const requestTwo = {
  ...requestOne,
  id: "request-2",
  title: "Need cones",
  description: "Need training cones for an evening football session.",
};

test("Requests page appends the next cursor page through Load more", async () => {
  const dom = installDom();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/api/public/v1/auth/session") return json(null);
    if (url.pathname === "/api/public/v1/requests" && url.searchParams.get("cursor") === "cursor-2") {
      return json({ items: [requestTwo], nextCursor: null });
    }
    if (url.pathname === "/api/public/v1/requests") {
      return json({ items: [requestOne], nextCursor: "cursor-2" });
    }
    return json({ error: { code: "NOT_FOUND", message: "Unexpected request" } }, 404);
  }) as typeof fetch;

  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider, RequestsPage } = await import("@hooma/frontend");

  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(RequestsPage, { tab: "requests" }),
      ),
    );
    await waitFor(() => assert.ok(view.getByText("Need boots")));
    fireEvent.click(view.getByRole("button", { name: /Load more/i }));
    await waitFor(() => assert.ok(view.getByText("Need cones")));
    assert.ok(calls.includes("/api/public/v1/requests?cursor=cursor-2"));
    assert.ok(view.getByText("Need boots"));
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("City and Houma filters debounce network reloads and do not repeat identity lookup", async () => {
  const dom = installDom();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    if (url.pathname === "/api/public/v1/auth/session") return json(null);
    if (url.pathname === "/api/public/v1/requests") return json({ items: [], nextCursor: null });
    return json({ error: { code: "NOT_FOUND", message: "Unexpected request" } }, 404);
  }) as typeof fetch;

  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider, RequestsPage } = await import("@hooma/frontend");

  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(RequestsPage, { tab: "requests" }),
      ),
    );
    await waitFor(() => assert.ok(view.getByText("No Requests match these filters.")));
    calls.length = 0;

    const city = view.getByLabelText("City");
    fireEvent.change(city, { target: { value: "T" } });
    fireEvent.change(city, { target: { value: "Tu" } });
    fireEvent.change(city, { target: { value: "Tunis" } });

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(calls.filter((call) => call.includes("/requests")).length, 0);

    await waitFor(
      () => {
        const requestCalls = calls.filter((call) => call.includes("/requests"));
        assert.deepEqual(requestCalls, ["/api/public/v1/requests?city=Tunis"]);
      },
      { timeout: 1000 },
    );
    assert.equal(calls.filter((call) => call.includes("/auth/session")).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});
