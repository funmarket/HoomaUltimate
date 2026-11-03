import assert from "node:assert/strict";
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
  return dom;
}

const placement = {
  id: "HOME_TOP" as const,
  enabled: false,
  slides: [],
};

test("PageBanner Admin renders the canonical placement and preserves empty state", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { PageBannerManager } = await import("../apps/web/src/admin/PageBannerManager");
  const calls: string[] = [];
  const adminApi = {
    pageBanners: {
      async list() {
        return [placement];
      },
      async setEnabled() {
        calls.push("setEnabled");
        return { ...placement, enabled: true };
      },
    },
  } as never;

  try {
    const view = render(React.createElement(PageBannerManager, { adminApi }));
    await waitFor(() => assert.ok(view.getByText("Home top banner")));
    assert.ok(view.getByText("No stored slides. Add the first banner when artwork is ready."));
    assert.ok(view.getByRole("button", { name: "Off" }));
    fireEvent.click(view.getByRole("button", { name: "Add slide" }));
    await waitFor(() => assert.ok(view.getByRole("heading", { name: "Add PageBanner slide" })));
    assert.deepEqual(calls, []);
  } finally {
    cleanup();
    dom.window.close();
  }
});

test("adding first enabled slide publishes an Off placement", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  Object.defineProperty(globalThis, "File", {
    value: dom.window.File,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { PageBannerManager } = await import("../apps/web/src/admin/PageBannerManager");
  const calls: string[] = [];
  const enabledPlacement = {
    ...placement,
    enabled: true,
    slides: [
      {
        id: "slide-1",
        placementId: "HOME_TOP" as const,
        mediaId: "media-1",
        sortOrder: 0,
        enabled: true,
        isDecorative: false,
        altText: "Match Day",
        destinationKind: null,
        destinationUrl: null,
        variants: [],
      },
    ],
  };
  let listedPlacement = placement;
  const adminApi = {
    pageBanners: {
      async list() {
        return [listedPlacement];
      },
      async upload() {
        calls.push("upload");
        listedPlacement = { ...placement, slides: enabledPlacement.slides };
        return enabledPlacement.slides[0];
      },
      async setEnabled() {
        calls.push("setEnabled");
        listedPlacement = enabledPlacement;
        return enabledPlacement;
      },
    },
  } as never;

  try {
    const view = render(React.createElement(PageBannerManager, { adminApi }));
    await waitFor(() => assert.ok(view.getByText("Home top banner")));
    fireEvent.click(view.getByRole("button", { name: "Add slide" }));
    const file = new dom.window.File(["banner"], "banner.webp", { type: "image/webp" });
    fireEvent.change(view.getByLabelText("Artwork"), { target: { files: [file] } });
    fireEvent.change(view.getByLabelText("Alt text (required)"), {
      target: { value: "Match Day" },
    });
    fireEvent.click(view.getByRole("button", { name: "Add slide" }));

    await waitFor(() => assert.deepEqual(calls, ["upload", "setEnabled"]));
    await waitFor(() => assert.ok(view.getByRole("button", { name: "On" })));
  } finally {
    cleanup();
    dom.window.close();
  }
});
