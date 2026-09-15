import assert from "node:assert/strict";
import test from "node:test";
import type { AdminPlaceReviewQueueItem } from "@hooma/contracts/platform-admin";
import { JSDOM } from "jsdom";

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
