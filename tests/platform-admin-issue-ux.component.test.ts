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

async function renderOverview(options: {
  readonly canManageIssues: boolean;
  readonly requestHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { render } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { ControlRoomOverview } = await import("../apps/web/src/admin/ControlRoomOverview");

  globalThis.fetch = options.requestHandler;

  return render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(ControlRoomOverview, {
        overview: null,
        overviewState: null,
        attentionItems: options.canManageIssues
          ? [{ label: "Admin issues", count: 1, href: "#admin-action-inbox", state: "ready" }]
          : [],
        adminIssues: [issue],
        adminIssuesState: "ready",
        recentAudit: [],
        auditState: null,
      }),
    ),
  );
}

test("Admin Issue UX requires a note and resolves through controlled confirmation", async () => {
  const dom = installDom();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const { cleanup, fireEvent, waitFor } = await import("@testing-library/react");

  try {
    const view = await renderOverview({
      canManageIssues: true,
      requestHandler: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        requests.push({
          method,
          path: `${url.pathname}${url.search}`,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (method === "POST" && url.pathname.endsWith("/resolve")) return json({ ok: true });
        if (method === "GET" && url.pathname === "/api/v1/admin/issues") return json([]);
        return json({ error: { message: `Unexpected request: ${method} ${url.pathname}` } }, 500);
      },
    });

    fireEvent.click(view.getByRole("button", { name: "Resolve" }));
    fireEvent.click(view.getByRole("button", { name: "Confirm resolve" }));

    assert.ok(view.getByText("A reason is required."));
    assert.equal(requests.length, 0);

    fireEvent.change(view.getByLabelText("Reason for resolving issue"), {
      target: { value: "Delivery recovered" },
    });
    fireEvent.click(view.getByRole("button", { name: "Confirm resolve" }));

    await waitFor(() => assert.ok(view.getByText("Admin issue resolved and audited.")));
    assert.deepEqual(requests[0], {
      method: "POST",
      path: `/api/v1/admin/issues/${encodeURIComponent(issue.id)}/resolve`,
      body: { note: "Delivery recovered" },
    });
    assert.deepEqual(requests[1], {
      method: "GET",
      path: "/api/v1/admin/issues?limit=25",
      body: null,
    });
    assert.ok(view.getByText("No operational admin issues require attention."));
    assert.ok(view.getByText("0"));
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("Admin Issue UX dismisses with controlled error feedback and hides actions for read-only issue viewers", async () => {
  const dom = installDom();
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const { cleanup, fireEvent, waitFor } = await import("@testing-library/react");

  try {
    const view = await renderOverview({
      canManageIssues: true,
      requestHandler: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        requests.push({
          method,
          path: `${url.pathname}${url.search}`,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (method === "POST" && url.pathname.endsWith("/dismiss")) {
          return json({ error: { message: "Disposition failed" } }, 500);
        }
        return json({ error: { message: `Unexpected request: ${method} ${url.pathname}` } }, 500);
      },
    });

    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));
    fireEvent.change(view.getByLabelText("Reason for dismissing issue"), {
      target: { value: "No action needed" },
    });
    fireEvent.click(view.getByRole("button", { name: "Confirm dismiss" }));

    await waitFor(() => assert.ok(view.getByText("Disposition failed")));
    assert.deepEqual(requests[0], {
      method: "POST",
      path: `/api/v1/admin/issues/${encodeURIComponent(issue.id)}/dismiss`,
      body: { note: "No action needed" },
    });

    view.rerender(
      (await import("react")).createElement(
        (await import("@hooma/frontend")).HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        (await import("react")).createElement(
          (await import("../apps/web/src/admin/ControlRoomOverview")).ControlRoomOverview,
          {
            overview: null,
            overviewState: null,
            attentionItems: [],
            adminIssues: [issue],
            adminIssuesState: "ready",
            recentAudit: [],
            auditState: null,
          },
        ),
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
