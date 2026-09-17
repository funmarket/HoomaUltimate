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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    requests.push({
      method,
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (method === "POST" && url.pathname.endsWith("/resolve")) return json({ ok: true });
    if (method === "GET" && url.pathname === "/api/v1/admin/issues") return json([]);
    return json({ error: { message: `Unexpected request: ${method} ${url.pathname}` } }, 500);
  };

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { ControlRoomOverview } = await import("../apps/web/src/admin/ControlRoomOverview");

  try {
    const props = {
      overview: null,
      overviewState: null,
      attentionItems: [
        { label: "Admin issues", count: 1, href: "#admin-action-inbox", state: "ready" as const },
      ],
      adminIssues: [issue],
      adminIssuesState: "ready" as const,
      recentAudit: [],
      auditState: null,
    };
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(ControlRoomOverview, props),
      ),
    );

    fireEvent.click(view.getByRole("button", { name: "Resolve" }));
    const note = view.getByLabelText("Reason for resolving issue");
    fireEvent.change(note, { target: { value: "Delivery recovered" } });
    fireEvent.click(view.getByRole("button", { name: "Confirm resolve" }));

    await waitFor(() => assert.ok(view.getByText("Admin issue resolved and audited.")));
    assert.deepEqual(requests[0], {
      method: "POST",
      path: `/api/v1/admin/issues/${encodeURIComponent(issue.id)}/resolve`,
      body: { note: "Delivery recovered" },
    });
    assert.equal(requests[1]?.method, "GET");
    assert.equal(requests[1]?.path, "/api/v1/admin/issues");
    assert.ok(view.getByText("No operational admin issues require attention."));
    assert.ok(view.getByText("0"));

    view.rerender(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(ControlRoomOverview, {
          ...props,
          attentionItems: [],
        }),
      ),
    );
    assert.equal(view.queryByRole("button", { name: "Resolve" }), null);
    assert.equal(view.queryByRole("button", { name: "Dismiss" }), null);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});
