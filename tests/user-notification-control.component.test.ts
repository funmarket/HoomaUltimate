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

// prettier-ignore
function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
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

  // jsdom does not implement the Popover API that the shared anchored-overlay primitive uses.
  const elementProto = dom.window.Element.prototype as unknown as {
    matches: (selector: string) => boolean;
  };
  const nativeMatches = elementProto.matches;
  elementProto.matches = function matches(this: Element, selector: string) {
    if (selector === ":popover-open") return this.hasAttribute("data-popover-open");
    return nativeMatches.call(this, selector);
  };
  const htmlProto = dom.window.HTMLElement.prototype as unknown as {
    showPopover: () => void;
    hidePopover: () => void;
  };
  htmlProto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute("data-popover-open", "");
  };
  htmlProto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute("data-popover-open");
  };
  return dom;
}

// prettier-ignore
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Stubs the fine-pointer hover capability query the shared overlay primitive uses. */
// prettier-ignore
function enableFinePointerHover(dom, matches = true) {
  dom.window.matchMedia = (query) => ({
    matches: query === "(hover: hover) and (pointer: fine)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

/** Captures the pending-close timer so the grace period can be asserted without real waiting. */
// prettier-ignore
function captureCloseTimers(dom) {
  const originalSetTimeout = dom.window.setTimeout;
  const originalClearTimeout = dom.window.clearTimeout;
  const timers = [];
  dom.window.setTimeout = (callback, delay) => {
    const entry = { callback, delay, cleared: false };
    timers.push(entry);
    return entry;
  };
  dom.window.clearTimeout = (handle) => {
    if (handle && typeof handle === "object" && "cleared" in handle) handle.cleared = true;
  };
  return {
    pending: () => timers.filter((entry) => !entry.cleared),
    restore: () => {
      dom.window.setTimeout = originalSetTimeout;
      dom.window.clearTimeout = originalClearTimeout;
    },
  };
}

/** Minimal bell harness: one unread moderation notice served by the mocked transport. */
// prettier-ignore
async function renderBell(dom) {
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { UserNotificationControl } = await import(
    "../apps/web/src/notifications/UserNotificationControl"
  );
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
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

  return { view, act, cleanup, fireEvent, waitFor, originalFetch };
}

// prettier-ignore
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

// prettier-ignore
test("bell shows a cleared sanction and resyncs when the server rejects the read", async () => {
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
  let listCalls = 0;

  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if ((init?.method ?? "GET") === "GET" && url.pathname === "/api/v1/notifications") {
        listCalls += 1;
        return json({
          unreadCount: 1,
          items: [
            {
              id: "n2",
              type: "MODERATION_SANCTION_CLEARED",
              actorUserId: "admin-1",
              strikeNumber: null,
              expiresAt: null,
              createdAt: "2026-09-19T12:00:00.000Z",
              readAt: null,
            },
          ],
        });
      }
      if (init?.method === "POST" && url.pathname === "/api/v1/notifications/n2/read") {
        return json(
          { error: { code: "USER_NOTIFICATION_NOT_FOUND", message: "Notification not found" } },
          404,
        );
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
    assert.ok(view.getByText(/Sanction cleared/i));
    assert.ok(view.getByText(/Lifted/i));

    const callsBeforeRead = listCalls;
    fireEvent.click(view.getByRole("button", { name: /Sanction cleared/i }));
    await waitFor(() => assert.ok(listCalls > callsBeforeRead));
    assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i }));
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

// prettier-ignore
test("bell reports the server unread total and the panel is a viewport-placed top-layer popover", async () => {
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

  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if ((init?.method ?? "GET") === "GET" && url.pathname === "/api/v1/notifications") {
        // The server total is larger than the visible list; the UI must report the server value.
        return json({
          unreadCount: 5,
          items: [
            {
              id: "n9",
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
      if (init?.method === "POST" && url.pathname === "/api/v1/notifications/n9/read") {
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
      assert.ok(view.getByRole("button", { name: /Notifications, 5 unread/i })),
    );
    fireEvent.click(view.getByRole("button", { name: /Notifications, 5 unread/i }));

    const panel = document.querySelector(".hooma-notification-popover");
    assert.ok(panel);
    assert.equal(panel.getAttribute("popover"), "auto");
    await waitFor(() =>
      assert.ok((panel as HTMLElement).style.maxHeight.length > 0),
    );
    assert.ok(Number.parseFloat((panel as HTMLElement).style.left) >= 0);

    fireEvent.click(view.getByRole("button", { name: /Yellow card warning/i }));
    await waitFor(() =>
      assert.ok(view.getByRole("button", { name: /Notifications, 4 unread/i })),
    );
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

const bellPopover = () => document.querySelector(".hooma-notification-popover");

// prettier-ignore
test("a pointer-opened notification panel closes after the pointer leaves the bell and the panel", async () => {
  const dom = installDom();
  enableFinePointerHover(dom);
  const { view, act, cleanup, fireEvent, waitFor, originalFetch } = await renderBell(dom);

  try {
    await waitFor(() => assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i })));
    const trigger = view.getByRole("button", { name: /Notifications, 1 unread/i });
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(bellPopover()));

    const timers = captureCloseTimers(dom);
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 1);
    assert.ok(pending[0].delay >= 150 && pending[0].delay <= 200, `grace was ${pending[0].delay}ms`);

    await act(async () => {
      pending[0].callback();
    });
    assert.equal(bellPopover(), null);
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

// prettier-ignore
test("crossing the bell-to-panel gap keeps the notification panel open", async () => {
  const dom = installDom();
  enableFinePointerHover(dom);
  const { view, cleanup, fireEvent, waitFor, originalFetch } = await renderBell(dom);

  try {
    await waitFor(() => assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i })));
    const trigger = view.getByRole("button", { name: /Notifications, 1 unread/i });
    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(bellPopover()));

    const timers = captureCloseTimers(dom);
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    assert.equal(pending.length, 1);

    fireEvent.pointerMove(bellPopover(), { pointerType: "mouse", clientX: 140, clientY: 220 });
    assert.equal(pending[0].cleared, true);
    assert.equal(timers.pending().length, 0);

    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const second = timers.pending();
    assert.equal(second.length, 1);
    fireEvent.pointerMove(trigger, { pointerType: "mouse", clientX: 300, clientY: 20 });
    assert.equal(second[0].cleared, true);
    timers.restore();

    assert.ok(bellPopover());
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

// prettier-ignore
test("a keyboard-opened notification panel is not closed by pointer movement", async () => {
  const dom = installDom();
  enableFinePointerHover(dom);
  const { view, cleanup, fireEvent, waitFor, originalFetch } = await renderBell(dom);

  try {
    await waitFor(() => assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i })));
    const trigger = view.getByRole("button", { name: /Notifications, 1 unread/i });
    // Keyboard activation: click without a pointerdown.
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(bellPopover()));

    const timers = captureCloseTimers(dom);
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 0);
    assert.ok(bellPopover());
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

// prettier-ignore
test("touch/coarse pointers keep the bell click-toggle behaviour", async () => {
  const dom = installDom();
  const { view, cleanup, fireEvent, waitFor, originalFetch } = await renderBell(dom);

  try {
    await waitFor(() => assert.ok(view.getByRole("button", { name: /Notifications, 1 unread/i })));
    const trigger = view.getByRole("button", { name: /Notifications, 1 unread/i });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(bellPopover()));

    const timers = captureCloseTimers(dom);
    fireEvent.pointerMove(document.body, { pointerType: "touch", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 0);
    assert.ok(bellPopover());

    fireEvent.click(trigger);
    assert.equal(bellPopover(), null);
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
