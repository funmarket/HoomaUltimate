import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { AdminIssueSummary } from "@hooma/contracts/platform-admin";
import { JSDOM } from "jsdom";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/admin",
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
  return dom;
}

const issue: AdminIssueSummary = {
  id: "outbox:test-issue",
  title: "Delivery failure",
  summary: "Notification delivery failed.",
  severity: "WARNING",
  source: "OUTBOX",
  occurrenceCount: 2,
  entityType: "Notification",
  entityId: "notification-1",
  createdAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "2026-09-17T11:00:00.000Z",
};

test("Admin Action Inbox uses controlled reason confirmation for issue dispositions", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { ControlRoomOverview } = await import("../apps/web/src/admin/ControlRoomOverview");
  const calls: Array<{ issueId: string; disposition: "resolve" | "dismiss"; note: string }> = [];

  try {
    const view = render(
      React.createElement(ControlRoomOverview, {
        overview: null,
        overviewState: null,
        attentionItems: [],
        adminIssues: [issue],
        adminIssuesState: "ready",
        canManageAdminIssues: true,
        pendingIssueAction: null,
        onIssueDisposition: async (issueId, disposition, note) => {
          calls.push({ issueId, disposition, note });
          return true;
        },
        recentAudit: [],
        auditState: null,
      }),
    );

    fireEvent.click(view.getByRole("button", { name: "Resolve" }));
    const note = view.getByLabelText("Reason for resolving issue");
    assert.ok(note);
    fireEvent.change(note, { target: { value: "Delivery recovered" } });
    fireEvent.click(view.getByRole("button", { name: "Confirm resolve" }));

    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(calls[0], {
      issueId: issue.id,
      disposition: "resolve",
      note: "Delivery recovered",
    });
    await waitFor(() => assert.equal(view.queryByLabelText("Reason for resolving issue"), null));

    view.rerender(
      React.createElement(ControlRoomOverview, {
        overview: null,
        overviewState: null,
        attentionItems: [],
        adminIssues: [issue],
        adminIssuesState: "ready",
        canManageAdminIssues: false,
        pendingIssueAction: null,
        onIssueDisposition: async () => true,
        recentAudit: [],
        auditState: null,
      }),
    );
    assert.equal(view.queryByRole("button", { name: "Resolve" }), null);
    assert.equal(view.queryByRole("button", { name: "Dismiss" }), null);
  } finally {
    cleanup();
    dom.window.close();
  }
});
