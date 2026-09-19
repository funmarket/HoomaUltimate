import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { AdminUserDetail, AdminUserSearchItem } from "@hooma/contracts/platform-admin";
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
  Object.defineProperty(globalThis, "FormData", { value: dom.window.FormData, configurable: true });
  return dom;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const adminUser: AdminUserSearchItem = {
  userId: "user-1",
  username: "member",
  displayName: "Member One",
  photoUrl: null,
  telegramUsername: null,
  hasWebCredential: true,
  lastLoginAt: null,
  activeSessionCount: 1,
  isPlatformAdmin: false,
  managerCapabilities: [],
};

const adminUserDetail: AdminUserDetail = {
  userId: "user-1",
  presentation: { username: "member", displayName: "Member One", photoUrl: null },
  identity: {
    web: { loginUsername: "member", email: "member@example.com", lastLoginAt: null },
    telegram: null,
  },
  access: { isPlatformAdmin: false, managerCapabilities: [] },
  security: {
    activeSessionCount: 1,
    sessions: [
      {
        id: "session-1",
        createdAt: "2026-09-18T10:00:00.000Z",
        lastSeenAt: "2026-09-18T10:30:00.000Z",
        expiresAt: "2026-09-25T10:00:00.000Z",
        revokedAt: null,
        isActive: true,
      },
    ],
  },
  moderation: {
    yellowCardCount: 2,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: false,
    readOnlyExpiresAt: null,
    isDisabled: false,
    activeSanctions: [],
    history: [],
  },
};

test("admin listbox avoids native select contrast and exposes readable options", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const { ManagedEntities } = await import("../apps/web/src/admin/ManagedEntities");

  try {
    const view = render(
      React.createElement(ManagedEntities, {
        communities: [
          {
            id: "community-1",
            name: "Readable HOOMA",
            slug: "readable",
            city: "Tunis",
            houma: null,
          },
        ],
        teams: [],
        communitiesState: "ready",
        teamsState: "ready",
      }),
    );

    assert.equal(view.container.querySelector("select"), null);
    fireEvent.click(view.getByRole("button", { name: /Select a HOOMA/ }));
    assert.ok(view.getByRole("option", { name: /Readable HOOMA/ }));
    assert.ok(view.container.querySelector(".admin-select-menu"));
  } finally {
    cleanup();
    dom.window.close();
  }
});

test("admin user controls use controlled reason UI and refresh sanction status", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("@hooma/frontend");
  const { AdminApp } = await import("../apps/web/src/admin/AdminApp");
  const originalFetch = globalThis.fetch;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];

  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({
        method,
        path: `${url.pathname}${url.search}`,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (method === "GET" && url.pathname === "/api/v1/admin/access") {
        return json({ isPlatformOwner: true, managerCapabilities: [] });
      }
      if (method === "GET" && url.pathname === "/api/v1/admin/overview") {
        return json({ users: 1, activePlatformAdmins: 1, activeAppManagers: 0, auditEntries: 0 });
      }
      if (method === "GET" && url.pathname === "/api/v1/admin/audit")
        return json({ items: [], nextCursor: null });
      if (method === "GET" && url.pathname === "/api/v1/admin/issues") return json([]);
      if (method === "GET" && url.pathname === "/api/v1/admin/managers") return json([]);
      if (method === "GET" && url.pathname === "/api/public/v1/communities")
        return json({ items: [], nextCursor: null });
      if (method === "GET" && url.pathname === "/api/v1/teams")
        return json({ items: [], nextCursor: null });
      if (method === "GET" && url.pathname === "/api/v1/admin/queues/places") return json([]);
      if (method === "GET" && url.pathname === "/api/v1/admin/queues/place-ownership")
        return json([]);
      if (method === "GET" && url.pathname === "/api/v1/admin/queues/pitch") return json([]);
      if (method === "GET" && url.pathname === "/api/v1/admin/queues/gamer-disputes")
        return json({ items: [] });
      if (method === "GET" && url.pathname === "/api/v1/admin/users") return json([adminUser]);
      if (method === "GET" && url.pathname === "/api/v1/admin/users/user-1")
        return json(adminUserDetail);
      if (method === "POST" && url.pathname === "/api/v1/admin/users/user-1/sanctions") {
        return json(
          { ok: true, moderation: { ...adminUserDetail.moderation, yellowCardCount: 3 } },
          201,
        );
      }
      return json({ error: { message: `Unexpected request: ${method} ${url.pathname}` } }, 500);
    };

    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://api.test" } },
        React.createElement(AdminApp),
      ),
    );

    await waitFor(() => assert.ok(view.getByText("User security administration")));
    fireEvent.change(view.getByPlaceholderText("Search username, email, Telegram ID, or user id"), {
      target: { value: "member" },
    });
    fireEvent.click(view.getByRole("button", { name: "Search users" }));
    await waitFor(() => assert.ok(view.getByText("Member One")));
    fireEvent.click(view.getByRole("button", { name: "View user security" }));
    await waitFor(() => assert.ok(view.getByText("2 yellow cards")));
    assert.equal(view.container.querySelector("select"), null);
    assert.ok(view.getByRole("button", { name: /Warn \/ yellow card/ }));
    fireEvent.change(view.getByLabelText("Reason"), { target: { value: "abuse warning" } });
    fireEvent.click(view.getByRole("button", { name: "Apply user control" }));
    await waitFor(() => assert.ok(view.getByText("User control saved and audited.")));

    assert.ok(requests.some((request) => request.path === "/api/v1/admin/users/user-1/sanctions"));
    assert.deepEqual(
      requests.find((request) => request.path === "/api/v1/admin/users/user-1/sanctions")?.body,
      { actionType: "YELLOW_CARD_WARNING", reason: "abuse warning", expiresAt: null },
    );
    assert.equal(view.container.textContent?.includes("window.prompt"), false);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});
