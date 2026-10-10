import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { PlaceForm } from "../packages/frontend/src/places/PlaceForm.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/places/test/edit",
});
Object.assign(globalThis, {
  React,
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const place = {
  id: "test-place",
  slug: "test-place",
  name: "Test Place",
  address: "Test road",
  city: null,
  houma: null,
  latitude: null,
  longitude: null,
  phone: null,
  websiteUrl: null,
  imageUrl: "https://example.test/0.jpg",
  images: [0, 1, 2, 3, 4, 5].map((n) => ({
    id: `image-${n}`,
    imageUrl: `https://example.test/${n}.jpg`,
    sortOrder: n,
  })),
  description: null,
  category: null,
  email: null,
  menuItems: [],
  submissionOrigin: "FANHUB" as const,
};

test("metadata Edit Place form neither submits nor limits the existing gallery", async () => {
  let submitted: Record<string, unknown> | undefined;
  try {
    const view = render(
      React.createElement(PlaceForm, {
        initialPlace: place,
        metadataOnly: true,
        submitLabel: "Save Place",
        pending: false,
        onSubmit: async (input: Record<string, unknown>) => {
          submitted = input;
        },
      }),
    );
    await React.act(async () => fireEvent.submit(view.container.querySelector("form")!));
    assert.ok(submitted, "an existing six-photo gallery must not block metadata saves");
    assert.equal(submitted.name, "Test Place");
    for (const key of ["imageUrls", "imageUrl", "imageFiles"])
      assert.equal(Object.hasOwn(submitted, key), false);
    assert.equal(view.queryByText("Photo 1 URL"), null);
  } finally {
    cleanup();
  }
});

test("initial suggestion form preserves its four URL submission workflow", async () => {
  let submitted: Record<string, unknown> | undefined;
  try {
    const view = render(
      React.createElement(PlaceForm, {
        submitLabel: "Suggest Place",
        pending: false,
        onSubmit: async (input: Record<string, unknown>) => {
          submitted = input;
        },
      }),
    );
    fireEvent.change(view.getByLabelText("Place name *"), { target: { value: "New Place" } });
    fireEvent.change(view.getByLabelText("Address *"), { target: { value: "Test road" } });
    for (const n of [1, 2, 3, 4])
      fireEvent.change(view.getByLabelText(`Photo ${n} URL`), {
        target: { value: `https://example.test/${n}.jpg` },
      });
    await React.act(async () => fireEvent.submit(view.container.querySelector("form")!));
    assert.ok(submitted);
    assert.deepEqual(
      submitted.imageUrls,
      [1, 2, 3, 4].map((n) => `https://example.test/${n}.jpg`),
    );
    assert.equal(submitted.imageUrl, "https://example.test/1.jpg");
  } finally {
    cleanup();
  }
});

test("Edit Place uses dedicated gallery operations and reports rejected photo changes", async () => {
  const { PlaceEditPage } = await import("../packages/frontend/src/places/PlaceEditPage.js");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context.js");
  const { waitFor } = await import("@testing-library/react");
  const originalFetch = globalThis.fetch;
  const calls: { path: string; method: string; body: unknown }[] = [];
  let images = place.images.slice(0, 2);
  let rejected = false;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ path, method, body });
    if (path.endsWith("/manage"))
      return Response.json({
        ...place,
        images,
        moderationStatus: "PENDING",
        archivedAt: null,
        mediaImageLimit: 3,
      });
    if (rejected)
      return Response.json(
        { error: { code: "PLACE_IMAGE_MANAGE_FORBIDDEN", message: "Photo permission denied" } },
        { status: 403 },
      );
    if (path.endsWith("/images/order")) {
      images = body.imageIds.map((id: string, sortOrder: number) => ({
        ...images.find((image) => image.id === id)!,
        sortOrder,
      }));
      return Response.json(images);
    }
    if (path.endsWith("/images/external") || path.endsWith("/images/upload")) {
      const image = {
        id: "new-image",
        imageUrl:
          body instanceof Blob
            ? "/api/public/v1/places/test-place/images/new-image/content"
            : body.url,
        sortOrder: images.length,
      };
      images = [...images, image];
      return Response.json(image, { status: 201 });
    }
    if (method === "DELETE") {
      images = images.filter((image) => !path.endsWith(`/${image.id}`));
      return Response.json({ ok: true });
    }
    return Response.json({ ...place, images, moderationStatus: "PENDING", archivedAt: null });
  };
  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://localhost" } },
        React.createElement(PlaceEditPage, { placeId: place.id }),
      ),
    );
    await waitFor(() => assert.equal(view.getAllByRole("img").length, 2));
    fireEvent.click(view.getAllByText("Move down")[0]!);
    await waitFor(() =>
      assert.equal(view.getAllByRole("img")[0]!.getAttribute("src"), place.images[1]!.imageUrl),
    );
    const reorder = calls.find((call) => call.method === "PUT");
    assert.deepEqual(reorder?.body, { imageIds: ["image-1", "image-0"] });
    fireEvent.change(view.getByLabelText("Image URL"), {
      target: { value: "https://example.test/new.jpg" },
    });
    fireEvent.submit(view.getByLabelText("Image URL").closest("form")!);
    await waitFor(() => assert.equal(view.getAllByRole("img").length, 3));
    fireEvent.click(view.getAllByText("Remove")[2]!);
    await waitFor(() => assert.equal(view.getAllByRole("img").length, 2));
    fireEvent.change(view.getByLabelText("Upload photo"), {
      target: {
        files: [new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" })],
      },
    });
    await waitFor(() => assert.equal(view.getAllByRole("img").length, 3));
    assert.ok(
      calls.some(
        (call) =>
          call.path.endsWith("/images/upload") &&
          call.method === "POST" &&
          call.body instanceof Blob,
      ),
    );
    rejected = true;
    fireEvent.click(view.getAllByText("Remove")[0]!);
    await waitFor(() => assert.ok(view.getByText("Photo permission denied")));
    assert.equal(view.getAllByRole("img").length, 3);
    assert.equal(view.queryByText("Place saved."), null);
    assert.equal(
      calls.some((call) => call.method === "PATCH"),
      false,
    );
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("generic metadata managers receive no gallery mutation controls", async () => {
  const { PlaceEditPage } = await import("../packages/frontend/src/places/PlaceEditPage.js");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context.js");
  const { waitFor } = await import("@testing-library/react");
  const originalFetch = globalThis.fetch;
  let patched: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === "PATCH") patched = JSON.parse(String(init.body));
    return Response.json({
      ...place,
      moderationStatus: "PENDING",
      archivedAt: null,
      mediaImageLimit: null,
    });
  };
  try {
    const view = render(
      React.createElement(
        HoomaFrontendProvider,
        { transport: { baseUrl: "http://localhost" } },
        React.createElement(PlaceEditPage, { placeId: place.id }),
      ),
    );
    await waitFor(() => assert.ok(view.getByText("Save Place")));
    assert.equal(view.queryByText("Add image URL"), null);
    assert.equal(view.queryByText("Photo 1 URL"), null);
    fireEvent.submit(view.getByText("Save Place").closest("form")!);
    await waitFor(() => assert.ok(view.getByText("Place saved.")));
    assert.ok(patched);
    for (const key of ["imageUrl", "imageUrls", "imageFiles"])
      assert.equal(Object.hasOwn(patched, key), false);
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("shared public Place gallery renders canonical order for Place and Watch detail consumers", async () => {
  const { registerHooks } = await import("node:module");
  const hooks = registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith("/places/place-gallery.css")
        ? { format: "module", source: "export {};", shortCircuit: true }
        : nextLoad(url, context);
    },
  });
  try {
    const { PlaceGallery } = await import("../packages/frontend/src/places/PlaceGallery.js");
    const view = render(
      React.createElement(PlaceGallery, {
        place: { ...place, images: [place.images[1]!, place.images[0]!] },
      }),
    );
    assert.equal(view.getByRole("img").getAttribute("src"), place.images[1]!.imageUrl);
    fireEvent.click(view.getByRole("button", { name: "Next photo" }));
    assert.equal(view.getByRole("img").getAttribute("src"), place.images[0]!.imageUrl);
  } finally {
    cleanup();
    hooks.deregister();
  }
});
