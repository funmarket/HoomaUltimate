import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

/**
 * jsdom does not implement the Popover API. The header only relies on
 * `showPopover`, `hidePopover` and the `:popover-open` state, so the test provides the
 * minimum deterministic behaviour instead of replacing the geometry under test.
 */
// prettier-ignore
function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.defineProperty(globalThis, "window", { value: window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  Object.defineProperty(globalThis, "HTMLElement", { value: window.HTMLElement, configurable: true });
  Object.defineProperty(globalThis, "Element", { value: window.Element, configurable: true });
  Object.defineProperty(globalThis, "Node", { value: window.Node, configurable: true });
  Object.defineProperty(globalThis, "Event", { value: window.Event, configurable: true });

  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  }

  const nativeMatches = window.Element.prototype.matches;
  window.Element.prototype.matches = function matches(selector) {
    if (selector === ":popover-open") return this.hasAttribute("data-popover-open");
    return nativeMatches.call(this, selector);
  };
  window.HTMLElement.prototype.showPopover = function showPopover() {
    this.setAttribute("data-popover-open", "");
  };
  window.HTMLElement.prototype.hidePopover = function hidePopover() {
    this.removeAttribute("data-popover-open");
  };
  return dom;
}

const USER = { displayName: "John Smith", username: "johnsmith", photoUrl: null };

// prettier-ignore
async function setup() {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", {
    value: React,
    writable: true,
    configurable: true,
  });
  const { cleanup, fireEvent, render, waitFor, act } = await import("@testing-library/react");
  const { HoomaAccountHeader } = await import("@hooma/ui");
  const { buildAccountMenuSections } = await import(
    "../apps/web/src/app/shell/account-menu-model"
  );
  return { dom, React, cleanup, fireEvent, render, waitFor, act, HoomaAccountHeader, buildAccountMenuSections };
}

/**
 * Stubs the fine-pointer hover capability query the shared overlay primitive uses.
 */
// prettier-ignore
function enableFinePointerHover(dom, matches = true) {
  dom.window.matchMedia = (query) => ({
    matches: query === "(hover: hover) and (pointer: fine)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

/**
 * Captures the pending-close timer so the grace period can be asserted without real waiting.
 */
// prettier-ignore
function captureCloseTimers(dom) {
  const originalSetTimeout = dom.window.setTimeout;
  const originalClearTimeout = dom.window.clearTimeout;
  const timers = [];
  dom.window.setTimeout = (callback, delay) => {
    const entry = { callback, delay, cleared: false };
    timers.push(entry);
    return entry;
  };
  dom.window.clearTimeout = (handle) => {
    if (handle && typeof handle === "object" && "cleared" in handle) handle.cleared = true;
  };
  return {
    pending: () => timers.filter((entry) => !entry.cleared),
    restore: () => {
      dom.window.setTimeout = originalSetTimeout;
      dom.window.clearTimeout = originalClearTimeout;
    },
  };
}

/**
 * Renders the header the way the shell composes it: authority facts in, generic sections out.
 */
// prettier-ignore
function renderMenu(context, options = {}) {
  const {
    React,
    render,
    HoomaAccountHeader,
    buildAccountMenuSections,
  } = context;
  const calls = {
    coach: [],
    settings: [],
    platform: [],
    passport: [],
    signOut: [],
  };
  const sections = buildAccountMenuSections({
    hasManagedTeams: Boolean(options.managedTeams),
    hasPlatformControlAccess: Boolean(options.platformAccess),
    onCoachControlRoom: () => calls.coach.push(true),
    onSettings: () => calls.settings.push(true),
    onPlatformControlRoom: () => calls.platform.push(true),
  });
  const props = {
    user: USER,
    loading: false,
    sections: options.sections ?? sections,
    identityAction: { label: "HOOMA Passport", onSelect: () => calls.passport.push(true) },
    onHome: () => undefined,
    onGuestProfile: () => undefined,
    ...(options.telegram ? {} : { onSignOut: () => calls.signOut.push(true) }),
  };
  const view = render(React.createElement(HoomaAccountHeader, props));
  return { view, calls };
}

const menuElement = () => document.querySelector(".hooma-account-menu");

// prettier-ignore
test("ordinary authenticated user sees Passport, Account and sign out only", async () => {
  const context = await setup();
  try {
    const { view } = renderMenu(context, { managedTeams: false, platformAccess: false });

    assert.ok(view.getByRole("button", { name: /John Smith/ }));
    assert.ok(view.getByText("@johnsmith"));
    assert.ok(view.getByRole("button", { name: /HOOMA Passport/ }));
    assert.ok(view.getByText("Settings & Security"));
    assert.ok(view.getByRole("button", { name: /Sign out/ }));

    assert.equal(view.queryByText("Coach Control Room"), null);
    assert.equal(view.queryByText("Platform Control Room"), null);
    assert.equal(view.queryByText("Control centers"), null);
    assert.equal(view.queryByText("Platform"), null);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("team manager sees Control centers with the Coach row", async () => {
  const context = await setup();
  try {
    const { view } = renderMenu(context, { managedTeams: true, platformAccess: false });

    assert.ok(view.getByText("Control centers"));
    assert.ok(view.getByText("Coach Control Room"));
    assert.ok(view.getByText("Manage your Teams"));
    assert.ok(view.getByText("Settings & Security"));
    assert.equal(view.queryByText("Platform Control Room"), null);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("platform control user sees Platform with the Platform row", async () => {
  const context = await setup();
  try {
    const { view } = renderMenu(context, { managedTeams: false, platformAccess: true });

    assert.ok(view.getByText("Platform"));
    assert.ok(view.getByText("Platform Control Room"));
    assert.ok(view.getByText("Operations, safety & administration"));
    assert.equal(view.queryByText("Coach Control Room"), null);
    assert.equal(view.queryByText("Control centers"), null);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("team manager with platform control sees both control sections", async () => {
  const context = await setup();
  try {
    const { view } = renderMenu(context, { managedTeams: true, platformAccess: true });

    assert.ok(view.getByText("Control centers"));
    assert.ok(view.getByText("Coach Control Room"));
    assert.ok(view.getByText("Platform"));
    assert.ok(view.getByText("Platform Control Room"));
    assert.ok(view.getByText("Settings & Security"));
    assert.ok(view.getByRole("button", { name: /Sign out/ }));
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("a section with no items renders no label", async () => {
  const context = await setup();
  try {
    const { React, render, HoomaAccountHeader } = context;
    const view = render(
      React.createElement(HoomaAccountHeader, {
        user: USER,
        loading: false,
        sections: [
          { id: "control-centers", label: "Control centers", items: [] },
          {
            id: "account",
            label: "Account",
            items: [
              {
                id: "settings-security",
                title: "Settings & Security",
                subtitle: "Account, login & appearance",
                icon: React.createElement("span"),
                onSelect: () => undefined,
              },
            ],
          },
        ],
        identityAction: { label: "HOOMA Passport", onSelect: () => undefined },
        onHome: () => undefined,
        onGuestProfile: () => undefined,
      }),
    );

    assert.equal(view.queryByText("Control centers"), null);
    assert.ok(view.getByText("Account"));
    assert.ok(view.getByText("Settings & Security"));
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("identity header opens the Passport destination", async () => {
  const context = await setup();
  try {
    const { view, calls } = renderMenu(context, { managedTeams: false, platformAccess: false });

    context.fireEvent.click(view.getByRole("button", { name: /John Smith/ }));

    assert.deepEqual(calls.passport, [true]);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("Account row opens Settings & Security", async () => {
  const context = await setup();
  try {
    const { view, calls } = renderMenu(context, { managedTeams: false, platformAccess: false });

    context.fireEvent.click(view.getByRole("button", { name: /Settings & Security/ }));

    assert.deepEqual(calls.settings, [true]);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("coach and platform selections reach their own destinations", async () => {
  const context = await setup();
  try {
    const { view, calls } = renderMenu(context, { managedTeams: true, platformAccess: true });

    context.fireEvent.click(view.getByRole("button", { name: /Coach Control Room/ }));
    assert.deepEqual(calls.coach, [true]);
    assert.deepEqual(calls.platform, []);

    context.fireEvent.click(view.getByRole("button", { name: /Platform Control Room/ }));
    assert.deepEqual(calls.platform, [true]);
    assert.deepEqual(calls.settings, []);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("selecting a row closes the account popover", async () => {
  const context = await setup();
  try {
    const { view, calls } = renderMenu(context, { managedTeams: false, platformAccess: false });
    const trigger = view.getByRole("button", { name: "Profile and account" });

    context.fireEvent.click(trigger);
    await context.waitFor(() => assert.ok(menuElement()?.hasAttribute("data-popover-open")));

    context.fireEvent.click(view.getByRole("button", { name: /Settings & Security/ }));
    await context.waitFor(() => assert.equal(menuElement()?.hasAttribute("data-popover-open"), false));

    assert.deepEqual(calls.settings, [true]);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("Telegram composition renders no sign out control", async () => {
  const context = await setup();
  try {
    const { view } = renderMenu(context, { telegram: true });

    assert.equal(view.queryByRole("button", { name: /Sign out/ }), null);
    assert.ok(view.getByText("Settings & Security"));
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("the shell remains responsible for Telegram sign-out omission", async () => {
  const shell = await readFile(
    new URL("../apps/web/src/app/shell/HoomaShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(shell, /\.\.\.\(!hasTelegramIdentity \? \{ onSignOut: \(\) => void signOut\(\) \} : \{\}\)/);
  assert.match(shell, /const \{ me, managedTeams, hasPlatformControlAccess, loading, error, refresh \} = useAccount\(\);/);
  assert.match(shell, /hasManagedTeams: managedTeams\.length > 0/);
  assert.match(shell, /hasPlatformControlAccess,/);
});

// prettier-ignore
test("the UI package receives no domain authority props", async () => {
  const header = await readFile(
    new URL("../packages/ui/src/account/HoomaAccountHeader.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(header, /canManageTeams|isPlatformAdmin|canManageAthletes|canManagePitch|canManageEvents/);
  assert.doesNotMatch(header, /@hooma\/(?:frontend|contracts|database)|@prisma\/client/);
  assert.match(header, /readonly sections: readonly HoomaAccountMenuSection\[\];/);
  assert.match(header, /readonly identityAction: HoomaAccountIdentityAction;/);
});

// prettier-ignore
test("a pointer-opened account menu closes after the pointer leaves the trigger and the popover", async () => {
  const context = await setup();
  try {
    enableFinePointerHover(context.dom);
    const { view } = renderMenu(context);
    const { fireEvent, waitFor, act } = context;
    const trigger = view.getByRole("button", { name: "Profile and account" });

    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(menuElement()?.hasAttribute("data-popover-open")));

    const timers = captureCloseTimers(context.dom);
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 1);
    assert.ok(pending[0].delay >= 150 && pending[0].delay <= 200, `grace was ${pending[0].delay}ms`);

    await act(async () => {
      pending[0].callback();
    });
    assert.equal(menuElement()?.hasAttribute("data-popover-open"), false);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("crossing the trigger-to-popover gap keeps the account menu open", async () => {
  const context = await setup();
  try {
    enableFinePointerHover(context.dom);
    const { view } = renderMenu(context);
    const { fireEvent, waitFor } = context;
    const trigger = view.getByRole("button", { name: "Profile and account" });

    fireEvent.pointerDown(trigger, { pointerType: "mouse" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(menuElement()?.hasAttribute("data-popover-open")));

    const timers = captureCloseTimers(context.dom);
    // The pointer crosses the gap between trigger and popover: briefly inside neither element.
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    assert.equal(pending.length, 1);

    fireEvent.pointerMove(menuElement(), { pointerType: "mouse", clientX: 140, clientY: 220 });
    assert.equal(pending[0].cleared, true);
    assert.equal(timers.pending().length, 0);

    // Returning to the trigger during the grace period must also cancel the pending close.
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const second = timers.pending();
    assert.equal(second.length, 1);
    fireEvent.pointerMove(trigger, { pointerType: "mouse", clientX: 300, clientY: 20 });
    assert.equal(second[0].cleared, true);
    timers.restore();

    assert.equal(menuElement()?.hasAttribute("data-popover-open"), true);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("a keyboard-opened account menu is not closed by pointer movement", async () => {
  const context = await setup();
  try {
    enableFinePointerHover(context.dom);
    const { view } = renderMenu(context);
    const { fireEvent, waitFor } = context;
    const trigger = view.getByRole("button", { name: "Profile and account" });

    // Keyboard activation produces a click without a pointerdown.
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(menuElement()?.hasAttribute("data-popover-open")));

    const timers = captureCloseTimers(context.dom);
    fireEvent.pointerMove(document.body, { pointerType: "mouse", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 0);
    assert.equal(menuElement()?.hasAttribute("data-popover-open"), true);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});

// prettier-ignore
test("touch/coarse pointers keep the click-toggle account menu behaviour", async () => {
  const context = await setup();
  try {
    // No matchMedia stub: the capability query is unavailable, as on touch devices.
    const { view } = renderMenu(context);
    const { fireEvent, waitFor } = context;
    const trigger = view.getByRole("button", { name: "Profile and account" });

    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    await waitFor(() => assert.ok(menuElement()?.hasAttribute("data-popover-open")));

    const timers = captureCloseTimers(context.dom);
    fireEvent.pointerMove(document.body, { pointerType: "touch", clientX: 4, clientY: 520 });
    const pending = timers.pending();
    timers.restore();

    assert.equal(pending.length, 0);
    assert.equal(menuElement()?.hasAttribute("data-popover-open"), true);

    fireEvent.click(trigger);
    assert.equal(menuElement()?.hasAttribute("data-popover-open"), false);
  } finally {
    context.cleanup();
    context.dom.window.close();
  }
});
