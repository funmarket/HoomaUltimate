import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { AthletesCalendarEntryView } from "@hooma/contracts/athletes";
import { JSDOM } from "jsdom";

test("Athletes Calendar Add plan submits without unmounting the Calendar", async () => {
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
  Object.defineProperty(globalThis, "FormData", {
    value: dom.window.FormData,
    configurable: true,
  });

  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { fireEvent, render, waitFor, cleanup } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
  const { AthletesCalendar } = await import("../packages/frontend/src/athletes/AthletesCalendar");

  const originalFetch = globalThis.fetch;
  let entries: AthletesCalendarEntryView[] = [];
  const requests: Array<{ method: string; url: string; body: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (!url.includes("/api/v1/athletes/community-1/calendar")) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }

    if (method === "GET") {
      return new Response(JSON.stringify({ items: entries, nextCursor: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        title: string;
        description: string | null;
        location: string | null;
        startsAt: string;
        endsAt: string;
        timezone: string;
      };
      requests.push({ method, url, body });
      const now = "2026-09-13T18:30:00.000Z";
      const created: AthletesCalendarEntryView = {
        id: "calendar-1",
        athletesCommunityId: "community-1",
        title: body.title,
        description: body.description,
        location: body.location,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        timezone: body.timezone,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        rsvp: {
          viewerStatus: null,
          counts: { going: 0, maybe: 0, notGoing: 0 },
        },
      };
      entries = [created];
      return new Response(JSON.stringify(created), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  try {
    const view = render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          HoomaFrontendProvider,
          { transport: { baseUrl: "http://api.test" } },
          React.createElement(AthletesCalendar, {
            athletesCommunityId: "community-1",
            founder: true,
          }),
        ),
      ),
    );

    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Calendar" })));
    fireEvent.click(view.getByRole("button", { name: "+ Add plan" }));

    const title = view.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Evening training" } });
    assert.equal(title.value, "Evening training");

    fireEvent.click(view.getByRole("button", { name: "Save plan" }));

    await waitFor(() => assert.equal(requests.length, 1));
    const request = requests[0];
    assert.ok(request);
    assert.equal(request.method, "POST");
    assert.equal((request.body as { title: string }).title, "Evening training");

    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Calendar" })));
    await waitFor(() => assert.ok(view.getByText("Evening training")));
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
});

test("Athletes Calendar renders the three member RSVP choices with a compact mobile-first control", async () => {
  const [component, css] = await Promise.all([
    readFile(
      new URL("../packages/frontend/src/athletes/AthletesCalendar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../packages/frontend/src/athletes/athletes-calendar.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(component, /status: "GOING", label: "Going"/);
  assert.match(component, /status: "MAYBE", label: "Maybe"/);
  assert.match(component, /status: "NOT_GOING", label: "Not going"/);
  assert.match(component, /aria-pressed=\{entry\.rsvp\.viewerStatus === option\.status\}/);
  assert.match(component, /setCalendarRsvp/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 44px/);
});
