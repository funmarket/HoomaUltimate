import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { PlatformAuditEntry } from "@hooma/frontend";

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
  Object.defineProperty(globalThis, "Element", { value: dom.window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: dom.window.Event, configurable: true });
  Object.defineProperty(globalThis, "FormData", { value: dom.window.FormData, configurable: true });
  return dom;
}

function auditEntry(overrides: Partial<PlatformAuditEntry> = {}): PlatformAuditEntry {
  return {
    id: "audit-1",
    actorUserId: "user-1",
    action: "USER_SESSION_REVOKED",
    entityType: "User",
    entityId: "target-1",
    createdAt: "2026-09-18T10:00:00.000Z",
    ...overrides,
  };
}

test("Audit Archive exposes safe filters and submits filter changes", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const { AuditArchive } = await import("../apps/web/src/admin/AuditArchive");
  const submitted: unknown[] = [];

  try {
    const view = render(
      React.createElement(AuditArchive, {
        entries: [auditEntry()],
        loadState: "ready",
        filters: { actor: "", action: "", entityType: "", from: "", to: "" },
        hasMore: false,
        isLoadingMore: false,
        onFilterChange: (filters: unknown) => submitted.push(filters),
        onRetry: () => undefined,
        onLoadMore: () => undefined,
      }),
    );

    fireEvent.change(view.getByLabelText("Actor user id"), { target: { value: "user-1" } });
    fireEvent.change(view.getByLabelText("Action"), {
      target: { value: "USER_SESSION_REVOKED" },
    });
    fireEvent.change(view.getByLabelText("Entity type"), { target: { value: "User" } });
    fireEvent.change(view.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(view.getByLabelText("To"), { target: { value: "2026-09-30" } });
    fireEvent.click(view.getByRole("button", { name: "Apply audit filters" }));

    assert.deepEqual(submitted, [
      {
        actor: "user-1",
        action: "USER_SESSION_REVOKED",
        entityType: "User",
        from: "2026-09-01",
        to: "2026-09-30",
      },
    ]);
    assert.equal(view.container.textContent?.includes("secret"), false);
  } finally {
    cleanup();
    dom.window.close();
  }
});

test("Audit Archive distinguishes filtered empty, retry, and load-more disabled states", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const { AuditArchive } = await import("../apps/web/src/admin/AuditArchive");
  let retries = 0;
  let loads = 0;

  try {
    const view = render(
      React.createElement(AuditArchive, {
        entries: [],
        loadState: "ready",
        filters: { actor: "user-1", action: "", entityType: "", from: "", to: "" },
        hasMore: true,
        isLoadingMore: true,
        onFilterChange: () => undefined,
        onRetry: () => {
          retries += 1;
        },
        onLoadMore: () => {
          loads += 1;
        },
      }),
    );

    assert.ok(view.getByText("No audit entries match these filters."));
    const loadMore = view.getByRole("button", { name: "Loading more audit entries…" });
    assert.equal(loadMore.hasAttribute("disabled"), true);
    fireEvent.click(loadMore);
    assert.equal(loads, 0);

    view.rerender(
      React.createElement(AuditArchive, {
        entries: [],
        loadState: "error",
        filters: { actor: "", action: "", entityType: "", from: "", to: "" },
        hasMore: false,
        isLoadingMore: false,
        onFilterChange: () => undefined,
        onRetry: () => {
          retries += 1;
        },
        onLoadMore: () => {
          loads += 1;
        },
      }),
    );

    fireEvent.click(view.getByRole("button", { name: "Retry audit archive" }));
    assert.equal(retries, 1);
    assert.ok(view.getByText("Audit archive is unavailable."));
  } finally {
    cleanup();
    dom.window.close();
  }
});
