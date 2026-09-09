import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";
import { HoomaFrontendProvider } from "../packages/frontend/dist/context.js";
import {
  AthletesDetailPage,
  AthletesPage,
} from "../packages/frontend/dist/athletes/AthletesPages.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "FormData",
  "MutationObserver",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const transport = { baseUrl: "https://api.example.test" };
function wrap(child) {
  return h(MemoryRouter, null, h(HoomaFrontendProvider, { transport }, child));
}
function community(id = "one", role = "FOUNDER") {
  return {
    id,
    slug: id,
    name: `Community ${id}`,
    sport: "RUNNING",
    description: "Run together",
    city: "Tunis",
    houma: null,
    logoUrl: "https://example.test/logo.png",
    bannerUrl: "https://example.test/banner.png",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 2,
    viewerRole: role,
    viewerJoinRequestStatus: null,
  };
}
function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function scenario(detail, overrides = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? "GET";
    calls.push({ path, method, body: init.body });
    const override = overrides[`${method} ${path}`];
    if (override) return override(init);
    if (method !== "GET") return response({ ok: true, id: detail.id });
    if (path.endsWith("/members"))
      return response([
        {
          userId: "runner",
          role: "MEMBER",
          joinedAt: detail.createdAt,
          presentation: { username: "runner", displayName: "Runner", photoUrl: null },
        },
      ]);
    if (path.endsWith("/join-requests"))
      return response({
        requests: [
          {
            id: "request",
            userId: "applicant",
            requester: {
              presentation: { displayName: "Applicant", username: "applicant", photoUrl: null },
            },
          },
        ],
      });
    if (path.endsWith("/photos")) return response([]);
    if (path.includes("/whistles/"))
      return response({
        items: [],
        remainingToday: 11,
        resetsAt: new Date(Date.now() + 86400000).toISOString(),
      });
    return response(detail);
  };
  return calls;
}

test("Founder can edit settings, change roles, remove members and archive through existing APIs", async () => {
  const detail = community();
  const calls = scenario(detail);
  const view = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "one" })));
  await view.findByText("Make moderator");
  assert.ok(view.getByAltText("Community one logo"));
  assert.ok(view.getByAltText("Community one banner"));
  fireEvent.click(view.getByText("Make moderator"));
  await waitFor(() =>
    assert.ok(calls.some((call) => call.method === "PATCH" && call.path.endsWith("/runner/role"))),
  );
  await view.findByText("Remove member");
  fireEvent.click(view.getByText("Remove member"));
  await waitFor(() =>
    assert.ok(
      calls.some((call) => call.method === "DELETE" && call.path.endsWith("/members/runner")),
    ),
  );
  fireEvent.click(await view.findByText("Edit community"));
  fireEvent.change(view.getByLabelText("Name"), { target: { value: "Updated runners" } });
  fireEvent.click(view.getByText("Save changes"));
  await waitFor(() =>
    assert.ok(
      calls.some(
        (call) => call.method === "PATCH" && JSON.parse(call.body).name === "Updated runners",
      ),
    ),
  );
  fireEvent.click(await view.findByText("Archive community"));
  fireEvent.click(view.getByText("Confirm archive"));
  await waitFor(() =>
    assert.ok(
      calls.some((call) => call.method === "DELETE" && call.path === "/api/v1/athletes/one"),
    ),
  );
});

test("Pending applicant sees cancellation and no duplicate join action", async () => {
  const calls = scenario({
    ...community("one", null),
    joinPolicy: "APPROVAL_REQUIRED",
    viewerJoinRequestStatus: "PENDING",
  });
  const view = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "one" })));
  await view.findByText("Join request pending");
  assert.equal(view.queryByText("Request to join"), null);
  fireEvent.click(view.getByText("Cancel request"));
  await waitFor(() =>
    assert.ok(
      calls.some((call) => call.method === "DELETE" && call.path.endsWith("/join-request")),
    ),
  );
  assert.equal(
    calls.some((call) => call.path.endsWith("/members")),
    false,
  );
});

test("Members have no management controls; managers see request load failures", async () => {
  scenario(community("one", "MEMBER"));
  const view = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "one" })));
  await view.findByText("Active Athletes");
  assert.equal(view.queryByText("Edit community"), null);
  assert.equal(view.queryByText("Remove member"), null);
  view.unmount();
  scenario(community("two", "MODERATOR"), {
    "GET /api/v1/athletes/two/join-requests": () =>
      response({ error: { message: "Requests unavailable" } }, 503),
  });
  const manager = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "two" })));
  await manager.findByText("Requests unavailable");
  assert.equal(manager.queryByText("No pending join requests."), null);
  assert.equal(manager.queryByText("Make moderator"), null);
});

test("Failed approval is surfaced and can be retried", async () => {
  scenario(community(), {
    "POST /api/v1/athletes/one/join-requests/applicant/approve": () =>
      response({ error: { message: "Approval unavailable" } }, 503),
  });
  const view = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "one" })));
  fireEvent.click(await view.findByText("Approve"));
  await view.findByText("Approval unavailable");
  assert.equal(view.getByText("Approve").disabled, false);
});

test("Changing community ignores delayed detail from the previous community", async () => {
  let finish;
  scenario(community("two", null), {
    "GET /api/v1/athletes/one": () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const view = render(wrap(h(AthletesDetailPage, { athletesCommunityId: "one" })));
  await waitFor(() => assert.ok(finish));
  view.rerender(wrap(h(AthletesDetailPage, { athletesCommunityId: "two" })));
  await view.findByText("Community two");
  finish(response(community("one")));
  await waitFor(() => assert.equal(view.queryByText("Community one"), null));
  assert.equal(view.queryByText("Edit community"), null);
});

test("Discovery consumes the cursor and appends older communities", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return response(
      url.includes("cursor=")
        ? { items: [community("older")], nextCursor: null }
        : { items: [community("newer")], nextCursor: "newer" },
    );
  };
  const view = render(wrap(h(AthletesPage, { onCreateCommunity: () => {} })));
  fireEvent.click(await view.findByText("Load more communities"));
  await view.findByText("Community older");
  assert.ok(view.getByText("Community newer"));
  assert.ok(urls.some((url) => url.includes("cursor=newer")));
});

test("Photo Board displays successful photos independently and retries a failed photo", async () => {
  const { AthletesPhotoBoard } =
    await import("../packages/frontend/dist/athletes/AthletesPhotoBoard.js");
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  const revoked = [];
  let secondFails = true;
  URL.createObjectURL = () => `blob:photo-${Math.random()}`;
  URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.fetch = async (url) => {
    if (url.endsWith("/photos"))
      return response(
        ["first", "second"].map((id) => ({
          id,
          athletesCommunityId: "one",
          contentType: "image/png",
          sizeBytes: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      );
    if (url.includes("/second/") && secondFails)
      return response({ error: { message: "Photo unavailable" } }, 503);
    return new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } });
  };
  try {
    const view = render(
      wrap(
        h(AthletesPhotoBoard, {
          athletesCommunityId: "one",
          communityStatus: "ACTIVE",
          viewerRole: "MEMBER",
        }),
      ),
    );
    await view.findByAltText("Photo 1 from Athletes Photo Board");
    await view.findByText("Photo unavailable");
    assert.equal(view.queryByText("Add photo"), null);
    secondFails = false;
    fireEvent.click(view.getByText("Retry photo 2"));
    await view.findByAltText("Photo 2 from Athletes Photo Board");
    view.unmount();
    assert.equal(revoked.length, 2);
  } finally {
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
  }
});
