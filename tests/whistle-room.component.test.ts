import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { WhistleListItem } from "../packages/frontend/src/api";

function whistle(id: string, createdAt: string): WhistleListItem {
  return {
    id,
    authorUserId: `user-${id}`,
    body: `whistle-${id}`,
    createdAt,
    expiresAt: "2026-09-13T00:00:00.000Z",
    author: {
      presentation: {
        displayName: `User ${id}`,
        username: `user${id}`,
        photoUrl: null,
      },
    },
  };
}

test("WhistleRoom follows latest by default but never yanks a user out of history", async () => {
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
  Object.defineProperty(globalThis, "getComputedStyle", {
    value: dom.window.getComputedStyle.bind(dom.window),
    configurable: true,
  });

  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains("whistle-room") ? 600 : 0;
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains("whistle-room") ? 300 : 0;
    },
  });

  const scrollCalls: Array<{ top: number; behavior: ScrollBehavior | undefined }> = [];
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value(this: HTMLElement, options: ScrollToOptions) {
      const top = Number(options.top ?? 0);
      this.scrollTop = Math.max(0, Math.min(top, this.scrollHeight - this.clientHeight));
      scrollCalls.push({ top, behavior: options.behavior });
    },
  });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { fireEvent, render, cleanup } = await import("@testing-library/react");
  const { WhistleRoom } = await import("../packages/frontend/src/whistle/WhistleRoom");

  const first = whistle("1", "2026-09-12T10:00:00.000Z");
  const second = whistle("2", "2026-09-12T10:01:00.000Z");
  const third = whistle("3", "2026-09-12T10:02:00.000Z");

  const view = render(
    React.createElement(WhistleRoom, {
      items: [first],
      emptyText: "No Whistles",
    }),
  );

  const room = view.getByRole("log") as HTMLDivElement;
  assert.equal(room.scrollTop, 300);
  assert.deepEqual(scrollCalls.at(-1), { top: 600, behavior: "auto" });

  room.scrollTop = 100;
  fireEvent.scroll(room);
  const scrollCallsBeforeHistoryUpdate = scrollCalls.length;

  view.rerender(
    React.createElement(WhistleRoom, {
      items: [first, second],
      emptyText: "No Whistles",
    }),
  );

  assert.equal(room.scrollTop, 100);
  assert.equal(scrollCalls.length, scrollCallsBeforeHistoryUpdate);
  assert.ok(view.getByRole("button", { name: "↓ Latest" }));

  room.scrollTop = 300;
  fireEvent.scroll(room);
  assert.equal(view.queryByRole("button", { name: "↓ Latest" }), null);

  view.rerender(
    React.createElement(WhistleRoom, {
      items: [first, second, third],
      emptyText: "No Whistles",
    }),
  );

  assert.equal(room.scrollTop, 300);
  assert.deepEqual(scrollCalls.at(-1), { top: 600, behavior: "smooth" });
  assert.equal(view.queryByRole("button", { name: "↓ Latest" }), null);

  cleanup();
  dom.window.close();
});
