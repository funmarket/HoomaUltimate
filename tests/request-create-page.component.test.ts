import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { requestsTaxonomy } from "./fixtures/requests-taxonomy.js";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

type RecordedCall = {
  readonly path: string;
  readonly method: string;
  readonly body: unknown;
  readonly contentType: string | null;
};

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/requests/new",
  });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    FormData: dom.window.FormData,
    File: dom.window.File,
    Blob: dom.window.Blob,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const meResponse = {
  id: "user-1",
  presentation: { username: "coach", displayName: "Coach Amine", photoUrl: null, bio: null },
  transports: ["web"],
  platformRoles: [],
  managerCapabilities: [],
  communities: [{ id: "community-1", name: "Tunis HOOMA", slug: "tunis", role: "FOUNDER" }],
  athletesCommunities: [
    { id: "athletes-1", name: "Athletes Tunis", slug: "athletes-tunis", role: "MODERATOR" },
  ],
  moderation: {
    yellowCardCount: 0,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: false,
    readOnlyExpiresAt: null,
    isDisabled: false,
  },
  teams: [
    {
      id: "team-1",
      name: "Etoile",
      slug: "etoile",
      badgeUrl: null,
      isPlayer: true,
      responsibilities: ["COACH"],
      capabilities: [],
    },
  ],
};

const createdRequest = { id: "request-9" };

function installApiStub(options: { readonly me?: unknown; readonly mediaStatus?: number }) {
  const calls: RecordedCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    let body: unknown = init?.body ?? null;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    calls.push({
      path: `${url.pathname}${url.search}`,
      method,
      body,
      contentType: new Headers(init?.headers).get("content-type"),
    });
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(requestsTaxonomy);
    if (url.pathname === "/api/v1/requests" && method === "POST") return json(createdRequest, 201);
    if (
      (url.pathname === "/api/v1/requests/request-9/image" ||
        url.pathname === "/api/v1/requests/request-9/image/external") &&
      method === "PUT"
    ) {
      if (options.mediaStatus && options.mediaStatus >= 400) {
        return json(
          { error: { code: "REQUEST_IMAGE_UPLOAD_FAILED", message: "Image upload failed" } },
          options.mediaStatus,
        );
      }
      return json({
        id: "image-1",
        source: url.pathname.endsWith("/external") ? "EXTERNAL_URL" : "UPLOAD",
        contentType: url.pathname.endsWith("/external") ? null : "image/png",
        sizeBytes: url.pathname.endsWith("/external") ? null : 3,
        updatedAt: "2026-09-23T13:00:00.000Z",
      });
    }
    return json(
      { error: { code: "NOT_FOUND", message: `Unexpected ${method} ${url.pathname}` } },
      404,
    );
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

async function renderCreatePage(options: { readonly me?: unknown; readonly mediaStatus?: number }) {
  const dom = installDom();
  const apiStub = installApiStub(options);
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor, within } = await import("@testing-library/react");
  const { HoomaFrontendProvider, RequestCreatePage } = await import("@hooma/frontend");
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      {
        transport: {
          baseUrl: "http://api.test",
          authenticationHref: (returnTo: string) =>
            `/login?returnTo=${encodeURIComponent(returnTo)}`,
        },
      },
      React.createElement(RequestCreatePage, null),
    ),
  );
  return {
    view,
    calls: apiStub.calls,
    fireEvent,
    waitFor,
    within,
    close: () => {
      apiStub.restore();
      cleanup();
      dom.window.close();
    },
  };
}

test("a guest is sent through the current HOOMA auth flow with returnTo preserved", async () => {
  const page = await renderCreatePage({ me: null });
  try {
    await page.waitFor(() =>
      assert.ok(page.view.getByRole("link", { name: /Sign in to continue/i })),
    );
    const link = page.view.getByRole("link", { name: /Sign in to continue/i });
    assert.equal(link.getAttribute("href"), "/login?returnTo=%2Frequests%2Fnew");
    assert.equal(page.view.queryByLabelText("Title"), null);
  } finally {
    page.close();
  }
});

test("a signed-in member can publish a Request and is linked to it", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));

    // Publisher choices come from the current MeResponse only.
    assert.ok(page.view.getByRole("option", { name: /Team · Etoile/ }));
    assert.ok(page.view.getByRole("option", { name: /HOOMA · Tunis HOOMA/ }));
    assert.ok(page.view.getByRole("option", { name: /Athletes · Athletes Tunis/ }));
    assert.ok(page.view.getByRole("option", { name: /Everyone/ }));

    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "SPORT" },
    });
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need size 43 running shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Looking for used or new running shoes for training sessions." },
    });
    page.fireEvent.change(page.view.getByLabelText("Full address"), {
      target: { value: "12 Avenue Habib Bourguiba" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));

    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(
      post,
      `expected a POST, saw ${page.calls.map((c) => `${c.method} ${c.path}`).join(" | ")}`,
    );
    assert.equal(post.path, "/api/v1/requests");
    assert.deepEqual(post.body, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      requestType: "SPORT",
      sport: "RUNNING",
      subcategoryId: "hts-running-footwear",
      needId: "htn-running-shoes",
      title: "Need size 43 running shoes",
      description: "Looking for used or new running shoes for training sessions.",
      fullAddress: "12 Avenue Habib Bourguiba",
    });

    const viewLink = page.view.getByRole("link", { name: /View Request/i });
    assert.equal(viewLink.getAttribute("href"), "/requests/request-9");
  } finally {
    page.close();
  }
});

test("a signed-in member can publish a Community Request without Sport", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Request Type")));
    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "COMMUNITY" },
    });
    assert.equal(page.view.queryByLabelText("Sport"), null);
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-community-lost-found" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Lost wallet near the station" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "I lost a wallet nearby and need help checking the area." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));
    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(post);
    assert.deepEqual(post.body, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      requestType: "COMMUNITY",
      subcategoryId: "hts-community-lost-found",
      needId: "htn-community-lost-item",
      title: "Lost wallet near the station",
      description: "I lost a wallet nearby and need help checking the area.",
    });
  } finally {
    page.close();
  }
});

test("invalid input is rejected by the shared contract without any write", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));
    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "SPORT" },
    });
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), { target: { value: "ok" } });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.container.querySelector(".request-error")));
    assert.equal(page.calls.filter((call) => call.method === "POST").length, 0);
    assert.equal(page.view.queryByRole("link", { name: /View Request/i }), null);
  } finally {
    page.close();
  }
});

async function fillValidRunningRequest(
  page: Awaited<ReturnType<typeof renderCreatePage>>,
): Promise<void> {
  await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));
  page.fireEvent.change(page.view.getByLabelText("Request Type"), {
    target: { value: "SPORT" },
  });
  page.fireEvent.change(page.view.getByLabelText("Sport"), {
    target: { value: "RUNNING" },
  });
  page.fireEvent.change(page.view.getByLabelText("Category"), {
    target: { value: "hts-running-footwear" },
  });
  page.fireEvent.change(page.view.getByLabelText("Specific need"), {
    target: { value: "htn-running-shoes" },
  });
  page.fireEvent.change(page.view.getByLabelText("Title"), {
    target: { value: "Need size 43 running shoes" },
  });
  page.fireEvent.change(page.view.getByLabelText("Description"), {
    target: { value: "Looking for used or new running shoes for training sessions." },
  });
}

test("Request creation attaches an external image only after the Request exists", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await fillValidRunningRequest(page);
    page.fireEvent.change(page.view.getByLabelText("Image URL"), {
      target: { value: "https://images.example.test/request.jpg" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));

    const writes = page.calls.filter((call) => call.method === "POST" || call.method === "PUT");
    assert.equal(writes[0]?.path, "/api/v1/requests");
    assert.equal(writes[1]?.path, "/api/v1/requests/request-9/image/external");
    assert.deepEqual(writes[1]?.body, { url: "https://images.example.test/request.jpg" });
  } finally {
    page.close();
  }
});

test(
  "Request creation uploads selected image bytes through the binary Request media endpoint",
  async () => {
    const page = await renderCreatePage({ me: meResponse });
    try {
      await fillValidRunningRequest(page);
      const file = new File([new Uint8Array([1, 2, 3])], "boots.png", { type: "image/png" });
      page.fireEvent.change(page.view.getByLabelText("Upload photo"), {
        target: { files: [file] },
      });
      page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

      await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));

      const upload = page.calls.find(
        (call) => call.method === "PUT" && call.path === "/api/v1/requests/request-9/image",
      );
      assert.ok(upload);
      assert.ok(upload.body instanceof Blob);
      assert.equal(upload.contentType, "image/png");
    } finally {
      page.close();
    }
  },
);

test("image failure preserves the created Request and offers a media retry", async () => {
  const page = await renderCreatePage({ me: meResponse, mediaStatus: 500 });
  try {
    await fillValidRunningRequest(page);
    page.fireEvent.change(page.view.getByLabelText("Image URL"), {
      target: { value: "https://images.example.test/request.jpg" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() =>
      assert.ok(page.view.getByText(/Request created, but the image could not be uploaded/i)),
    );
    assert.ok(page.view.getByRole("link", { name: /View Request/i }));
    assert.ok(page.view.getByRole("button", { name: /Retry image/i }));
    assert.equal(
      page.calls.filter((call) => call.method === "POST" && call.path === "/api/v1/requests").length,
      1,
      "media failure must not recreate or delete the successfully-created Request",
    );
  } finally {
    page.close();
  }
});
