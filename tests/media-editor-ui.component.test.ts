import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    File: dom.window.File,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

async function setup() {
  const dom = installDom();
  const React = await import("react");
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const ui = await import("@hooma/ui");
  return { dom, React, cleanup, fireEvent, render, ...ui };
}

test("MediaUploadField renders an accessible upload choice and hides URL controls by default", async () => {
  const context = await setup();
  try {
    const view = context.render(
      context.React.createElement(context.MediaUploadField, {
        label: "Photo",
        helpText: "Optional.",
      }),
    );
    const fileInput = view.getByLabelText("Upload photo");
    assert.equal(fileInput.getAttribute("type"), "file");
    assert.match(view.getByText(/Accepted:/).textContent ?? "", /JPEG/);
    assert.equal(view.queryByLabelText("Image URL"), null);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("MediaUploadField shows caller-provided preview, URL choice, replace and delete callbacks", async () => {
  const context = await setup();
  try {
    let replaced: File | null = null;
    let deleted = 0;
    let url = "";
    const view = context.render(
      context.React.createElement(context.MediaUploadField, {
        label: "Photo",
        preview: { src: "/current.webp", alt: "Current listing photo" },
        allowExternalUrl: true,
        externalUrlValue: url,
        onExternalUrlChange: (value: string) => {
          url = value;
        },
        onReplaceFile: (file: File | null) => {
          replaced = file;
        },
        onDelete: () => {
          deleted += 1;
        },
      }),
    );

    assert.equal(view.getByAltText("Current listing photo").getAttribute("src"), "/current.webp");
    const file = new File(["image"], "replacement.webp", { type: "image/webp" });
    context.fireEvent.change(view.getByLabelText("Replace photo"), { target: { files: [file] } });
    assert.equal(replaced?.name, "replacement.webp");

    context.fireEvent.change(view.getByLabelText("Image URL"), {
      target: { value: "https://example.com/photo.webp" },
    });
    assert.equal(url, "https://example.com/photo.webp");

    context.fireEvent.click(
      view.getByRole("button", { name: "Delete photo: Current listing photo" }),
    );
    assert.equal(deleted, 1);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("MediaUploadField exposes busy and error semantics and disables mutations", async () => {
  const context = await setup();
  try {
    const view = context.render(
      context.React.createElement(context.MediaUploadField, {
        label: "Photo",
        preview: { src: "/current.webp", alt: "Current photo" },
        busy: true,
        message: "Saving photo…",
        error: "Upload failed.",
        onDelete: () => undefined,
      }),
    );
    assert.equal((view.getByLabelText("Replace photo") as HTMLInputElement).disabled, true);
    assert.equal(
      (view.getByRole("button", { name: "Delete photo: Current photo" }) as HTMLButtonElement)
        .disabled,
      true,
    );
    assert.equal(view.getByRole("status").textContent, "Saving photo…");
    assert.equal(view.getByRole("alert").textContent, "Upload failed.");
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

const galleryItems = [
  { id: "one", src: "/one.webp", alt: "First photo" },
  { id: "two", src: "/two.webp", alt: "Second photo" },
] as const;

test("MediaGalleryEditor shows the caller max count and allows adding below the limit", async () => {
  const context = await setup();
  try {
    let added: File | null = null;
    const view = context.render(
      context.React.createElement(context.MediaGalleryEditor, {
        label: "Gallery",
        items: galleryItems,
        maxItems: 7,
        onAddFile: (file: File | null) => {
          added = file;
        },
      }),
    );
    assert.equal(view.getByText("2 / 7").textContent, "2 / 7");
    const add = view.getByLabelText("Add photo") as HTMLInputElement;
    assert.equal(add.disabled, false);
    const file = new File(["image"], "new.webp", { type: "image/webp" });
    context.fireEvent.change(add, { target: { files: [file] } });
    assert.equal(added?.name, "new.webp");
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("MediaGalleryEditor disables add at max while replace, delete and reorder stay caller-controlled", async () => {
  const context = await setup();
  try {
    let replaced = "";
    let deleted = "";
    let reordered = "";
    const view = context.render(
      context.React.createElement(context.MediaGalleryEditor, {
        label: "Gallery",
        items: galleryItems,
        maxItems: 2,
        onReplaceFile: (itemId: string) => {
          replaced = itemId;
        },
        onDelete: (itemId: string) => {
          deleted = itemId;
        },
        onReorder: (itemId: string, direction: "up" | "down") => {
          reordered = `${itemId}:${direction}`;
        },
      }),
    );

    assert.equal((view.getByLabelText("Add photo") as HTMLInputElement).disabled, true);
    const replacement = view.getByLabelText("Replace photo 1") as HTMLInputElement;
    assert.equal(replacement.disabled, false);
    const file = new File(["image"], "replacement.webp", { type: "image/webp" });
    context.fireEvent.change(replacement, { target: { files: [file] } });
    assert.equal(replaced, "one");

    context.fireEvent.click(view.getByRole("button", { name: "Delete photo: First photo" }));
    assert.equal(deleted, "one");

    context.fireEvent.click(view.getByRole("button", { name: "Move First photo down" }));
    assert.equal(reordered, "one:down");
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("MediaGalleryEditor adds an external URL only when enabled and not at quota", async () => {
  const context = await setup();
  try {
    let changed = "";
    let added = "";
    const view = context.render(
      context.React.createElement(context.MediaGalleryEditor, {
        label: "Gallery",
        items: [],
        maxItems: 3,
        allowExternalUrl: true,
        externalUrlValue: "https://example.com/photo.webp",
        onExternalUrlChange: (value: string) => {
          changed = value;
        },
        onAddExternalUrl: (value: string) => {
          added = value;
        },
      }),
    );

    context.fireEvent.change(view.getByLabelText("Image URL"), {
      target: { value: "https://example.com/next.webp" },
    });
    assert.equal(changed, "https://example.com/next.webp");
    context.fireEvent.click(view.getByRole("button", { name: "Add image URL" }));
    assert.equal(added, "https://example.com/photo.webp");
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("MediaGalleryEditor omits URL controls when the caller disables external URLs", async () => {
  const context = await setup();
  try {
    const view = context.render(
      context.React.createElement(context.MediaGalleryEditor, {
        label: "Gallery",
        items: galleryItems,
        maxItems: 3,
        allowExternalUrl: false,
      }),
    );
    assert.equal(view.queryByLabelText("Image URL"), null);
    assert.equal(view.queryByRole("button", { name: "Add image URL" }), null);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

test("shared media editor sources remain domain-neutral", async () => {
  const sources = await Promise.all([
    readFile(new URL("../packages/ui/src/media/MediaUploadField.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/ui/src/media/MediaGalleryEditor.tsx", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");
  assert.doesNotMatch(source, /@hooma\/(contracts|frontend|database)/);
  assert.doesNotMatch(source, /Prisma|Railway|ObjectStorage/);
  assert.doesNotMatch(source, /Gear Up|Donation|Admin Place|Request =|Ride =/);
});
