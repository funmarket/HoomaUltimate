import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
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
  Object.defineProperty(globalThis, "Element", {
    value: dom.window.Element,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: dom.window.Event, configurable: true });
  return dom;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("notification bell shows unread moderation notice and marks it read", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { UserNotificationControl } = await import(
    "../apps/web/src/notifications/UserNotificationControl"
  );
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];

  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
      if ((init?.method ?? "GET") === "GET" && url.pathname === "/api/v1/notifications") {
        return json({
          unreadCount: 1,
          items: [
            {
              id: "n1",
              type: "MODERATION_YELLOW_CARD",
              actorUserId: "admin-1",
              strikeNumber: 1,
              expiresAt: null,
              createdAt: "2026-09-19T10:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (init?.method === "POST" && url.pathname === "/api/v1/notifications/n1/read") {
        return json({ ok: true });
      }
      return json({ error: { message: "unexpected" } }, 500);
    };

    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(UserNotificationControl, { enabled: true }),
      ),
    );

    await waitFor(() =>
      assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i })),
    );
    fireEvent.click(view.getByRole("button", { name: /Notifications, 1 unread/i }));
    assert.ok(view.getByText(/Yellow card warning/i));
    fireEvent.click(view.getByRole("button", { name: /Yellow card warning/i }));
    await waitFor(() =>
      assert.ok(requests.includes("POST /api/v1/notifications/n1/read")),
    );
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});
