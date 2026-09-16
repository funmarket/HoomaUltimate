import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { MeResponse } from "@hooma/contracts";
import type { GamerDispute } from "@hooma/contracts/gamers";
import type { AdminPlaceReviewQueueItem } from "@hooma/contracts/platform-admin";
import { JSDOM } from "jsdom";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

test("Platform Control Room keeps visible module states independent", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: dom.window.Event, configurable: true });
  Object.defineProperty(globalThis, "FormData", {
    value: dom.window.FormData,
    configurable: true,
  });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render } = await import("@testing-library/react");
  const { ReviewQueues } = await import("../apps/web/src/admin/ReviewQueues");
  const { AccessManagers } = await import("../apps/web/src/admin/AccessManagers");
  const { ManagedEntities } = await import("../apps/web/src/admin/ManagedEntities");
  const { ControlRoomOverview } = await import("../apps/web/src/admin/ControlRoomOverview");

  const placeReview = {
    id: "place-review-1",
    place: {
      name: "Ready Place",
      houma: null,
      city: "Tunis",
      address: "1 Test Street",
    },
    applicant: {
      displayName: "Applicant",
      username: "applicant",
    },
  } as AdminPlaceReviewQueueItem;

  try {
    const queueView = render(
      React.createElement(ReviewQueues, {
        queues: {
          places: [placeReview],
          "place-ownership": [],
          pitch: [],
        },
        queueStates: {
          places: "ready",
          "place-ownership": "error",
          pitch: "loading",
        },
        showPlaceQueues: true,
        showPitchQueue: true,
        pendingDecision: null,
        onDecision: () => undefined,
      }),
    );

    assert.ok(queueView.getByText("Ready Place"));
    assert.ok(queueView.getByText("This queue is unavailable."));
    assert.ok(queueView.getByText("Loading queue…"));
    assert.equal(queueView.getAllByText("—").length, 2);
    queueView.unmount();

    const managerView = render(
      React.createElement(AccessManagers, {
        managers: [],
        loadState: "error",
        isSaving: false,
        onSubmit: async () => undefined,
      }),
    );

    assert.ok(managerView.getByText("App Managers are unavailable."));
    assert.ok(managerView.getByText("—"));
    assert.equal(managerView.queryByText("No App Managers have delegated permissions."), null);
    managerView.rerender(
      React.createElement(AccessManagers, {
        managers: [],
        loadState: "ready",
        isSaving: false,
        onSubmit: async () => undefined,
      }),
    );
    assert.ok(managerView.getByText("No App Managers have delegated permissions."));
    managerView.unmount();

    const entityView = render(
      React.createElement(ManagedEntities, {
        communities: [],
        teams: [],
        communitiesState: "loading",
        teamsState: "error",
      }),
    );

    assert.ok(entityView.getByText("Loading active HOOMAs…"));
    assert.ok(entityView.getByText("Active Teams are unavailable."));
    assert.equal(entityView.getAllByText("—").length, 2);
    assert.equal(entityView.queryByText("No active HOOMAs."), null);
    assert.equal(entityView.queryByText("No active Teams."), null);
    entityView.rerender(
      React.createElement(ManagedEntities, {
        communities: [],
        teams: [],
        communitiesState: "ready",
        teamsState: "ready",
      }),
    );
    assert.ok(entityView.getByText("No active HOOMAs."));
    assert.ok(entityView.getByText("No active Teams."));
    entityView.unmount();

    const overviewView = render(
      React.createElement(ControlRoomOverview, {
        overview: null,
        overviewState: "loading",
        attentionItems: [],
        recentAudit: [],
        auditState: "error",
      }),
    );

    assert.ok(overviewView.getByText("Loading platform totals…"));
    assert.ok(overviewView.getByText("Recent activity is unavailable."));
    overviewView.rerender(
      React.createElement(ControlRoomOverview, {
        overview: null,
        overviewState: "error",
        attentionItems: [],
        recentAudit: [],
        auditState: "loading",
      }),
    );
    assert.ok(overviewView.getByText("Platform totals are unavailable."));
    assert.ok(overviewView.getByText("Loading recent activity…"));
  } finally {
    cleanup();
    dom.window.close();
  }
});

test("Platform Control Room refreshes only the resource changed by an admin write", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: dom.window.Event, configurable: true });
  Object.defineProperty(globalThis, "FormData", {
    value: dom.window.FormData,
    configurable: true,
  });
  Object.defineProperty(dom.window, "prompt", {
    value: () => "Reviewed",
    configurable: true,
  });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { AdminApp } = await import("../apps/web/src/admin/AdminApp");

  const originalFetch = globalThis.fetch;
  const requestCounts = new Map<string, number>();
  let resolveManagerWrite!: (response: Response) => void;
  let resolvePlaceDecision!: (response: Response) => void;
  const managerWrite = new Promise<Response>((resolve) => {
    resolveManagerWrite = resolve;
  });
  const placeDecision = new Promise<Response>((resolve) => {
    resolvePlaceDecision = resolve;
  });
  const placeReview = {
    id: "place-review-1",
    place: {
      name: "Ready Place",
      houma: null,
      city: "Tunis",
      address: "1 Test Street",
    },
    applicant: {
      displayName: "Applicant",
      username: "applicant",
    },
  } as AdminPlaceReviewQueueItem;
  const secondPlaceReview = {
    ...placeReview,
    id: "place-review-2",
    place: { ...placeReview.place, name: "Second Place" },
  } as AdminPlaceReviewQueueItem;

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}${url.search}`;
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);

    if (method === "GET" && url.pathname === "/api/v1/admin/access") {
      return json({ isPlatformOwner: true, managerCapabilities: [] });
    }
    if (method === "GET" && url.pathname === "/api/v1/admin/overview") {
      return json({ users: 1, activePlatformAdmins: 1, activeAppManagers: 0, auditEntries: 0 });
    }
    if (method === "GET" && url.pathname === "/api/v1/admin/audit") return json([]);
    if (method === "GET" && url.pathname === "/api/v1/admin/issues") return json([]);
    if (method === "GET" && url.pathname === "/api/v1/admin/managers") return json([]);
    if (method === "PUT" && url.pathname === "/api/v1/admin/managers/manager") {
      return managerWrite;
    }
    if (method === "GET" && url.pathname === "/api/v1/admin/queues/places") {
      return json([placeReview, secondPlaceReview]);
    }
    if (
      method === "POST" &&
      url.pathname === "/api/v1/admin/queues/places/place-review-1/decision"
    ) {
      return placeDecision;
    }
    if (method === "GET" && url.pathname === "/api/v1/admin/queues/place-ownership") {
      return json([]);
    }
    if (method === "GET" && url.pathname === "/api/v1/admin/queues/pitch") return json([]);
    if (method === "GET" && url.pathname === "/api/v1/admin/queues/gamer-disputes") {
      return json({ items: [] });
    }
    if (method === "GET" && url.pathname === "/api/public/v1/communities") {
      return json({ items: [], nextCursor: null });
    }
    if (method === "GET" && url.pathname === "/api/public/v1/teams") {
      return json({ items: [], nextCursor: null });
    }
    return json({ error: { message: `Unexpected request: ${key}` } }, 500);
  };

  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(AdminApp),
      ),
    );

    await waitFor(() => assert.ok(view.getByText("No App Managers have delegated permissions.")));
    await waitFor(() => assert.ok(view.getByText("Ready Place")));

    const initialGetCounts = new Map([...requestCounts].filter(([key]) => key.startsWith("GET ")));

    fireEvent.change(view.getByPlaceholderText("HOOMA username"), {
      target: { value: "manager" },
    });
    fireEvent.click(view.getByLabelText(/Pitch Review/));
    const managerButton = view.getByRole("button", { name: "Save App Manager permissions" });
    fireEvent.click(managerButton);
    fireEvent.click(managerButton);

    assert.equal(requestCounts.get("PUT /api/v1/admin/managers/manager"), 1);
    await waitFor(() => assert.equal(managerButton.hasAttribute("disabled"), true));
    resolveManagerWrite(json({ ok: true }));

    await waitFor(() => assert.ok(view.getByText("App Manager permissions saved.")));
    await waitFor(() => assert.equal(requestCounts.get("GET /api/v1/admin/managers"), 2));
    for (const [key, count] of initialGetCounts) {
      if (
        key !== "GET /api/v1/admin/managers" &&
        key !== "GET /api/v1/admin/overview" &&
        !key.startsWith("GET /api/v1/admin/audit") &&
        !key.startsWith("GET /api/v1/admin/issues")
      ) {
        assert.equal(requestCounts.get(key), count, key);
      }
    }
    assert.equal(requestCounts.get("GET /api/v1/admin/overview"), 2);
    assert.equal(requestCounts.get("GET /api/v1/admin/audit?limit=100"), 2);

    const beforeDecision = new Map(requestCounts);
    const [approveButton, secondApproveButton] = view.getAllByRole("button", { name: "Approve" });
    fireEvent.click(approveButton);
    fireEvent.click(approveButton);
    fireEvent.click(secondApproveButton);

    assert.equal(requestCounts.get("POST /api/v1/admin/queues/places/place-review-1/decision"), 1);
    assert.equal(
      requestCounts.get("POST /api/v1/admin/queues/places/place-review-2/decision"),
      undefined,
    );
    await waitFor(() => assert.equal(approveButton.hasAttribute("disabled"), true));
    await waitFor(() => assert.equal(secondApproveButton.hasAttribute("disabled"), true));
    resolvePlaceDecision(json({ ok: true }));

    await waitFor(() => assert.ok(view.getByText("Decision saved and audited.")));
    await waitFor(() => assert.equal(requestCounts.get("GET /api/v1/admin/queues/places"), 2));
    for (const [key, count] of beforeDecision) {
      if (
        key.startsWith("GET ") &&
        key !== "GET /api/v1/admin/queues/places" &&
        key !== "GET /api/v1/admin/overview" &&
        !key.startsWith("GET /api/v1/admin/audit") &&
        !key.startsWith("GET /api/v1/admin/issues")
      ) {
        assert.equal(requestCounts.get(key), count, key);
      }
    }
    assert.equal(requestCounts.get("GET /api/v1/admin/overview"), 3);
    assert.equal(requestCounts.get("GET /api/v1/admin/audit?limit=100"), 3);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("Gamer disputes distinguish unavailable proof from absent proof", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { GamerDisputeConsole } = await import("../apps/web/src/admin/GamerDisputeConsole");

  const dispute: GamerDispute = {
    id: "match-1",
    challengeId: "challenge-1",
    status: "DISPUTED",
    roomCode: "123456",
    submissionDeadline: null,
    finalChallengerScore: null,
    finalChallengedScore: null,
    winnerSide: null,
    resolution: null,
    resolvedAt: null,
    game: { id: "game-1", slug: "ea-fc", name: "EA FC" },
    challenger: {
      id: "profile-1",
      handle: "challenger-handle",
      presentation: { username: "challenger", displayName: "Challenger", photoUrl: null },
    },
    challenged: {
      id: "profile-2",
      handle: "challenged-handle",
      presentation: { username: "challenged", displayName: "Challenged", photoUrl: null },
    },
    submissions: [
      {
        id: "submission-1",
        side: "CHALLENGER",
        challengerScore: 2,
        challengedScore: 1,
        submittedAt: "2026-09-16T00:00:00.000Z",
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/admin/queues/gamer-disputes") {
      return new Response(JSON.stringify({ items: [dispute] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname.endsWith("/proof/challenger")) {
      return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 500 });
  };

  const counts: number[] = [];
  const states: string[] = [];
  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(GamerDisputeConsole, {
          onCountChange: (count: number) => counts.push(count),
          onQueueStateChange: (state: string) => states.push(state),
        }),
      ),
    );

    await waitFor(() => assert.ok(view.getByText("Challenger proof unavailable")));
    assert.ok(view.getByText("No Challenged player proof submitted"));
    assert.equal(view.queryByText("No Challenger proof submitted"), null);
    assert.equal(counts.at(-1), 1);
    assert.equal(states.at(-1), "ready");
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("App Manager capabilities project only their authorized Control Room modules", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { AdminApp } = await import("../apps/web/src/admin/AdminApp");

  const originalFetch = globalThis.fetch;
  let capability: "REVIEW_PITCH_APPLICATIONS" | "VIEW_AUDIT" = "REVIEW_PITCH_APPLICATIONS";
  let requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url.pathname);
    if (url.pathname === "/api/v1/admin/access") {
      return new Response(
        JSON.stringify({ isPlatformOwner: false, managerCapabilities: [capability] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname === "/api/v1/admin/queues/pitch") {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/api/v1/admin/overview") {
      return new Response(
        JSON.stringify({
          users: 1,
          activePlatformAdmins: 1,
          activeAppManagers: 1,
          auditEntries: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname === "/api/v1/admin/audit") {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/api/v1/admin/issues") {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(null, { status: 500 });
  };

  function controlRoom() {
    return React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(AdminApp),
    );
  }

  try {
    const pitchView = render(controlRoom());
    await waitFor(() => assert.ok(pitchView.getByText("Pitch business applications")));
    assert.ok(pitchView.getByText("Pitch Review"));
    assert.equal(pitchView.queryByText("Place submissions"), null);
    assert.equal(pitchView.queryByText("Access & Managers"), null);
    assert.equal(pitchView.queryByText("EA FC Match Evidence"), null);
    assert.equal(pitchView.queryByText("Audit Archive"), null);
    assert.deepEqual(requested.sort(), ["/api/v1/admin/access", "/api/v1/admin/queues/pitch"]);
    cleanup();

    capability = "VIEW_AUDIT";
    requested = [];
    const auditView = render(controlRoom());
    await waitFor(() => assert.ok(auditView.getAllByText("Audit Archive").length));
    assert.equal(auditView.queryByText("Pitch business applications"), null);
    assert.equal(auditView.queryByText("Place submissions"), null);
    assert.equal(auditView.queryByText("Access & Managers"), null);
    assert.deepEqual(requested.sort(), [
      "/api/v1/admin/access",
      "/api/v1/admin/audit",
      "/api/v1/admin/issues",
      "/api/v1/admin/overview",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("Gamer dispute resolution is guarded and reports successful audited moderation", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: dom.window.Event, configurable: true });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { GamerDisputeConsole } = await import("../apps/web/src/admin/GamerDisputeConsole");

  const dispute: GamerDispute = {
    id: "match-2",
    challengeId: "challenge-2",
    status: "DISPUTED",
    roomCode: "654321",
    submissionDeadline: null,
    finalChallengerScore: null,
    finalChallengedScore: null,
    winnerSide: null,
    resolution: null,
    resolvedAt: null,
    game: { id: "game-1", slug: "ea-fc", name: "EA FC" },
    challenger: {
      id: "profile-1",
      handle: "challenger-handle",
      presentation: { username: "challenger", displayName: "Challenger", photoUrl: null },
    },
    challenged: {
      id: "profile-2",
      handle: "challenged-handle",
      presentation: { username: "challenged", displayName: "Challenged", photoUrl: null },
    },
    submissions: [
      {
        id: "submission-1",
        side: "CHALLENGER",
        challengerScore: 2,
        challengedScore: 1,
        submittedAt: "2026-09-16T00:00:00.000Z",
      },
      {
        id: "submission-2",
        side: "CHALLENGED",
        challengerScore: 1,
        challengedScore: 3,
        submittedAt: "2026-09-16T00:01:00.000Z",
      },
    ],
  };

  const secondDispute: GamerDispute = {
    ...dispute,
    id: "match-3",
    challengeId: "challenge-3",
    roomCode: "777777",
  };

  const originalFetch = globalThis.fetch;
  const requestCounts = new Map<string, number>();
  let resolveModeration!: (response: Response) => void;
  let resolveSecondModeration!: (response: Response) => void;
  const moderation = new Promise<Response>((resolve) => {
    resolveModeration = resolve;
  });
  const secondModeration = new Promise<Response>((resolve) => {
    resolveSecondModeration = resolve;
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
    if (method === "GET" && url.pathname === "/api/v1/admin/queues/gamer-disputes") {
      return new Response(JSON.stringify({ items: [dispute, secondDispute] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "GET" && url.pathname.includes("/proof/")) {
      return new Response(new Blob(["proof"]), { status: 200 });
    }
    if (
      method === "POST" &&
      url.pathname === "/api/v1/admin/queues/gamer-disputes/match-2/resolve"
    ) {
      return moderation;
    }
    if (
      method === "POST" &&
      url.pathname === "/api/v1/admin/queues/gamer-disputes/match-3/resolve"
    ) {
      return secondModeration;
    }
    return new Response(null, { status: 500 });
  };

  let resolvedCallbacks = 0;
  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(GamerDisputeConsole, {
          onResolved: () => {
            resolvedCallbacks += 1;
          },
        }),
      ),
    );

    await waitFor(() => assert.ok(view.getAllByAltText("Challenger submitted match proof").length));
    const [firstNotes, secondNotes] = view.getAllByPlaceholderText(
      "Explain the evidence and final judgment",
    );
    fireEvent.change(firstNotes, {
      target: { value: "Reviewed both score submissions" },
    });
    fireEvent.change(secondNotes, {
      target: { value: "Reviewed second dispute" },
    });
    const [challengerClaim, secondChallengerClaim] = view.getAllByRole("button", {
      name: "Use Challenger Claim",
    });
    const [challengedClaim, secondChallengedClaim] = view.getAllByRole("button", {
      name: "Use Challenged Claim",
    });
    fireEvent.click(challengerClaim);
    fireEvent.click(challengerClaim);
    fireEvent.click(challengedClaim);
    fireEvent.click(secondChallengerClaim);
    fireEvent.click(challengerClaim);

    assert.equal(requestCounts.get("POST /api/v1/admin/queues/gamer-disputes/match-2/resolve"), 1);
    assert.equal(requestCounts.get("POST /api/v1/admin/queues/gamer-disputes/match-3/resolve"), 1);
    await waitFor(() => assert.equal(challengerClaim.hasAttribute("disabled"), true));
    await waitFor(() => assert.equal(challengedClaim.hasAttribute("disabled"), true));
    await waitFor(() => assert.equal(secondChallengerClaim.hasAttribute("disabled"), true));
    await waitFor(() => assert.equal(secondChallengedClaim.hasAttribute("disabled"), true));
    resolveSecondModeration(
      new Response(JSON.stringify({ id: "match-3" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await waitFor(() => assert.equal(resolvedCallbacks, 1));
    assert.equal(challengerClaim.hasAttribute("disabled"), true);
    resolveModeration(
      new Response(JSON.stringify({ id: "match-2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await waitFor(() => assert.equal(resolvedCallbacks, 2));
    assert.equal(requestCounts.get("GET /api/v1/admin/queues/gamer-disputes"), 3);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("Profile exposes Platform Control Room entry for Platform Admins and delegated App Managers", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render } = await import("@testing-library/react");
  const { ProfileContent } = await import("../apps/web/src/profile/ProfilePage");

  const me: MeResponse = {
    id: "user-1",
    presentation: { username: "manager", displayName: "Manager", photoUrl: null, bio: null },
    transports: ["web"],
    platformRoles: [],
    managerCapabilities: ["VIEW_AUDIT"],
    communities: [],
    teams: [],
  };

  try {
    const view = render(React.createElement(ProfileContent, { me, profile: null }));
    const managerLink = view.getByRole("link", { name: "Open Platform Control Room" });
    assert.equal(managerLink.getAttribute("href"), "/admin");
    assert.equal(view.queryByText("Open App Admin"), null);

    view.rerender(
      React.createElement(ProfileContent, {
        me: { ...me, managerCapabilities: [], platformRoles: [] },
        profile: null,
      }),
    );
    assert.equal(view.queryByRole("link", { name: "Open Platform Control Room" }), null);

    view.rerender(
      React.createElement(ProfileContent, {
        me: { ...me, managerCapabilities: [], platformRoles: ["PLATFORM_ADMIN"] },
        profile: null,
      }),
    );
    assert.ok(view.getByRole("link", { name: "Open Platform Control Room" }));
  } finally {
    cleanup();
    dom.window.close();
  }
});

test("Platform Control Room renders operational admin issues separately from audit evidence", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.defineProperty(globalThis, "HTMLElement", {
    value: dom.window.HTMLElement,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render } = await import("@testing-library/react");
  const { ControlRoomOverview } = await import("../apps/web/src/admin/ControlRoomOverview");

  try {
    const view = render(
      React.createElement(ControlRoomOverview, {
        overview: { users: 4, activePlatformAdmins: 1, activeAppManagers: 1, auditEntries: 7 },
        overviewState: "ready",
        attentionItems: [],
        adminIssues: [
          {
            id: "issue-outbox-failed",
            title: "Outbox delivery failed",
            summary: "A Telegram delivery outbox event failed after retries.",
            severity: "WARNING",
            source: "OUTBOX",
            occurrenceCount: 3,
            entityType: "OutboxEvent",
            entityId: "outbox-1",
            createdAt: "2026-09-16T00:00:00.000Z",
            updatedAt: "2026-09-16T01:00:00.000Z",
          },
        ],
        adminIssuesState: "ready",
        recentAudit: [
          {
            id: "audit-1",
            actorUserId: "admin-1",
            action: "APP_MANAGER_CAPABILITIES_SET",
            entityType: "User",
            entityId: "manager-1",
            createdAt: "2026-09-16T02:00:00.000Z",
          },
        ],
        auditState: "ready",
      }),
    );

    assert.ok(view.getByText("Admin Action Inbox"));
    assert.ok(view.getByText("Outbox delivery failed"));
    assert.ok(view.getByText(/3 occurrences/));
    assert.ok(view.getByText("Latest audit evidence"));
    assert.ok(view.getByText("APP_MANAGER_CAPABILITIES_SET"));
  } finally {
    cleanup();
    dom.window.close();
  }
});
