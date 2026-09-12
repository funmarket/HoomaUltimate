import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function entry(id: string, title: string, startsAt: string): AthletesCalendarEntry {
  return {
    id,
    athletesCommunityId: "athletes-1",
    title,
    description: null,
    startsAt,
    endsAt: null,
    timezone: "Africa/Tunis",
    locationName: null,
    status: "SCHEDULED",
    cancelledAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

test("Athletes Calendar ignores a stale month response after navigation", async () => {
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

  const first = deferred<Response>();
  const second = deferred<Response>();
  let requests = 0;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => {
      requests += 1;
      return requests === 1 ? first.promise : second.promise;
    },
  });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
  const { useAthletesCalendar } = await import(
    "../packages/frontend/src/athletes/calendar/useAthletesCalendar"
  );

  function Probe({ monthKey }: { readonly monthKey: string }) {
    const { entries, loading } = useAthletesCalendar("athletes-1", monthKey);
    return React.createElement(
      "div",
      null,
      React.createElement("span", { "data-testid": "loading" }, String(loading)),
      React.createElement("span", { "data-testid": "title" }, entries[0]?.title ?? "empty"),
    );
  }

  const renderProbe = (monthKey: string) =>
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(Probe, { monthKey }),
    );

  const view = render(renderProbe("2026-09-01"));
  await waitFor(() => assert.equal(requests, 1));

  view.rerender(renderProbe("2026-10-01"));
  await waitFor(() => assert.equal(requests, 2));

  second.resolve(response([entry("october", "October training", "2026-10-08T17:00:00.000Z")]));
  await waitFor(() => assert.equal(view.getByTestId("title").textContent, "October training"));
  assert.equal(view.getByTestId("loading").textContent, "false");

  first.resolve(response([entry("september", "September training", "2026-09-08T17:00:00.000Z")]));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(view.getByTestId("title").textContent, "October training");
  assert.equal(view.getByTestId("loading").textContent, "false");

  cleanup();
  dom.window.close();
});
