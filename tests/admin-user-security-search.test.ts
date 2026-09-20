import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const adminUserSummary = {
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

// prettier-ignore
const adminUserDetail = {
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

// prettier-ignore
function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  Object.defineProperty(globalThis, "HTMLElement", { value: dom.window.HTMLElement, configurable: true });
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

// prettier-ignore
async function renderControlRoom({ usersResponse }) {
  const dom = installDom();
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
  const requests: { method: string; path: string; body: string }[] = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    requests.push({ method, path: url.pathname, body: String(init?.body ?? "") });
    if (url.pathname === "/api/v1/admin/access") {
      return json({ isPlatformOwner: false, managerCapabilities: ["MANAGE_USERS"] });
    }
    if (url.pathname === "/api/v1/admin/users") return usersResponse();
    if (url.pathname === "/api/v1/admin/users/user-1") return json(adminUserDetail);
    if (url.pathname === "/api/v1/admin/users/user-1/sessions/revoke") {
      return json({ ok: true, revokedSessionCount: 1 });
    }
    return new Response(null, { status: 500 });
  };

  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(AdminApp),
    ),
  );

  const userRequests = () => requests.filter((request) => request.path === "/api/v1/admin/users");

  return { dom, view, requests, userRequests, fireEvent, waitFor, cleanup, originalFetch };
}

// prettier-ignore
test("User Security opens search-first and reports its empty and error states truthfully", async () => {
  let mode: "empty" | "error" = "empty";
  const context = await renderControlRoom({
    usersResponse: () => (mode === "error" ? new Response(null, { status: 500 }) : json([])),
  });

  try {
    const { view, fireEvent, waitFor, userRequests } = context;
    await waitFor(() => assert.ok(view.getByText("User security administration")));

    // Opening the Control Room is not a search: no user query, and the administrator is told so.
    assert.ok(view.getByText("Search for a HOOMA user to review account security."));
    assert.equal(userRequests().length, 0);

    const field = view.getByPlaceholderText("Search username, email, Telegram ID, or user id");

    // An unusable query never reaches the API.
    fireEvent.change(field, { target: { value: "a" } });
    fireEvent.click(view.getByRole("button", { name: "Search users" }));
    assert.equal(userRequests().length, 0);

    fireEvent.change(field, { target: { value: "nobody" } });
    fireEvent.click(view.getByRole("button", { name: "Search users" }));
    await waitFor(() => assert.ok(view.getByText("No users matched.")));
    assert.equal(userRequests().length, 1);
    assert.equal(view.queryByText("Search for a HOOMA user to review account security."), null);

    mode = "error";
    fireEvent.change(field, { target: { value: "member" } });
    fireEvent.click(view.getByRole("button", { name: "Search users" }));
    await waitFor(() => assert.ok(view.getByText("User search is unavailable.")));
    assert.equal(userRequests().length, 2);
  } finally {
    context.cleanup();
    globalThis.fetch = context.originalFetch;
    context.dom.window.close();
  }
});

// prettier-ignore
test("a searched user still loads canonical Identity detail and session revocation still works", async () => {
  const context = await renderControlRoom({ usersResponse: () => json([adminUserSummary]) });

  try {
    const { view, fireEvent, waitFor, requests } = context;
    await waitFor(() => assert.ok(view.getByText("User security administration")));

    const field = view.getByPlaceholderText("Search username, email, Telegram ID, or user id");
    fireEvent.change(field, { target: { value: "member" } });
    fireEvent.click(view.getByRole("button", { name: "Search users" }));
    await waitFor(() =>
      assert.ok(view.getByRole("button", { name: /View user security/i })),
    );

    fireEvent.click(view.getByRole("button", { name: /View user security/i }));
    await waitFor(() =>
      assert.ok(view.getByText("Reason for revoking active sessions")),
    );
    assert.ok(
      requests.some((request) => request.path === "/api/v1/admin/users/user-1"),
    );

    fireEvent.change(view.getByLabelText(/Reason for revoking active sessions/i), {
      target: { value: "suspected token theft" },
    });
    fireEvent.click(view.getByRole("button", { name: /Revoke active sessions/i }));
    await waitFor(() =>
      assert.ok(
        requests.some(
          (request) =>
            request.method === "POST" && request.path.endsWith("/sessions/revoke"),
        ),
      ),
    );
    const revocation = requests.find((request) => request.path.endsWith("/sessions/revoke"));
    assert.match(String(revocation?.body), /suspected token theft/);
  } finally {
    context.cleanup();
    globalThis.fetch = context.originalFetch;
    context.dom.window.close();
  }
});

// prettier-ignore
test("AdminApp ships no runtime demo-user data or fallback list", async () => {
  const source = await readFile(
    new URL("../apps/web/src/admin/AdminApp.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /const users\s*=\s*\[/);
  assert.doesNotMatch(source, /fakeUser|demoUser|mockUser|sampleUser/i);
  assert.doesNotMatch(source, /setAdminUsers\(\[/);
  // Exactly one writer of the user list, fed by the canonical Identity-owned search.
  assert.equal((source.match(/setAdminUsers\(/g) ?? []).length, 1);
  assert.match(source, /await adminApi\.users\(query\)/);
  // The loader is defined once and called only by the explicit search handler.
  assert.equal((source.match(/loadAdminUsers\(/g) ?? []).length, 2);
});
