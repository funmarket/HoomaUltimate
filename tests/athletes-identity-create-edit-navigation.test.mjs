import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement as h } from "react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { HoomaFrontendProvider } from "../packages/frontend/dist/context.js";
import {
  AthletesDetailPage,
  CreateAthletesPage,
} from "../packages/frontend/dist/athletes/AthletesPages.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "FormData"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { render, fireEvent, waitFor, cleanup, configure } = await import("@testing-library/react");
configure({ asyncUtilTimeout: 10000 });
const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });

function DetailRoute() {
  const { id } = useParams();
  return h(AthletesDetailPage, { athletesCommunityId: id });
}

function LocationProbe() {
  const location = useLocation();
  return h("output", { "data-testid": "location" }, location.pathname);
}

test("creating an Athletes community navigates to detail and edit returns to detail", async () => {
  let detail = null;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({ path: url.pathname, method, body: init.body });

    if (url.pathname === "/api/v1/athletes" && method === "POST") {
      const inputBody = JSON.parse(String(init.body));
      assert.equal(inputBody.logoUrl, null);
      assert.equal(inputBody.bannerUrl, null);
      detail = {
        id: "community-test",
        slug: "training-circle",
        name: inputBody.name,
        sport: inputBody.sport,
        description: inputBody.description,
        city: inputBody.city,
        houma: inputBody.houma,
        logoUrl: null,
        bannerUrl: null,
        logoMediaPath: null,
        bannerMediaPath: null,
        visibility: inputBody.visibility,
        joinPolicy: inputBody.joinPolicy,
        status: "ACTIVE",
        createdAt: "2026-11-26T00:00:00.000Z",
        updatedAt: "2026-11-26T00:00:00.000Z",
        memberCount: 1,
        viewerRole: "FOUNDER",
        viewerJoinRequestStatus: null,
      };
      return json(detail);
    }
    if (url.pathname === "/api/v1/athletes/community-test" && method === "GET") {
      return json(detail);
    }
    if (url.pathname === "/api/v1/athletes/community-test" && method === "PATCH") {
      const inputBody = JSON.parse(String(init.body));
      detail = { ...detail, name: inputBody.name, updatedAt: "2026-11-26T00:01:00.000Z" };
      return json(detail);
    }
    if (url.pathname.endsWith("/members") || url.pathname.endsWith("/join-requests")) {
      return json({ items: [], nextCursor: null });
    }
    throw new Error("Unexpected request: " + method + " " + url.pathname);
  };

  const view = render(
    h(
      MemoryRouter,
      { initialEntries: ["/athletes/new"] },
      h(
        HoomaFrontendProvider,
        { transport: { baseUrl: "https://api.example.test" } },
        h(
          Routes,
          null,
          h(Route, { path: "/athletes/new", element: h(CreateAthletesPage) }),
          h(Route, { path: "/athletes/:id", element: h(DetailRoute) }),
        ),
        h(LocationProbe),
      ),
    ),
  );

  try {
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "Training circle" } });
    fireEvent.click(view.getByRole("button", { name: "Create community" }));
    await waitFor(() =>
      assert.equal(view.getByTestId("location").textContent, "/athletes/community-test"),
    );
    await waitFor(() => assert.ok(view.getByRole("button", { name: "Edit community" })));

    fireEvent.click(view.getByRole("button", { name: "Edit community" }));
    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Edit Training circle" })));
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "Updated training circle" } });
    fireEvent.click(view.getByRole("button", { name: "Save changes" }));
    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Updated training circle" })));
    assert.equal(view.getByTestId("location").textContent, "/athletes/community-test");
    assert.ok(calls.some((call) => call.path === "/api/v1/athletes" && call.method === "POST"));
    assert.ok(
      calls.some(
        (call) => call.path === "/api/v1/athletes/community-test" && call.method === "PATCH",
      ),
    );
  } finally {
    cleanup();
  }
});
