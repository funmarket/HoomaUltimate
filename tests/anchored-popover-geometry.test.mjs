import assert from "node:assert/strict";
import test from "node:test";
import { anchoredPopoverGeometry } from "../packages/ui/src/overlay/anchored-popover";

const MARGIN = 12;
const GAP = 8;

/**
 * The popover geometry reads the window viewport, the bottom navigation and the anchor
 * rectangle. These stubs reproduce that contract without a browser so the collision maths can
 * be asserted directly at real device widths.
 */
// prettier-ignore
function installViewport({ width, height, offsetLeft = 0, offsetTop = 0, bottomNavTop = null }) {
  const nav =
    bottomNavTop === null
      ? null
      : {
          getBoundingClientRect: () => ({
            top: bottomNavTop,
            bottom: bottomNavTop + 64,
            left: 0,
            right: width,
          }),
        };
  Object.defineProperty(globalThis, "window", {
    value: {
      visualViewport: { width, height, offsetLeft, offsetTop },
      innerWidth: width,
      innerHeight: height,
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: {
      querySelector: (selector) => (selector.includes("hooma-bottom-nav") ? nav : null),
    },
    configurable: true,
  });
}

function anchorRect({ right, bottom }) {
  return {
    getBoundingClientRect: () => ({
      right,
      bottom,
      left: right - 44,
      top: bottom - 44,
      width: 44,
      height: 44,
    }),
  };
}

/** The top bar places the account avatar after the bell, so the bell's right edge sits here. */
function bellRightFor(width) {
  return width - 12 - 44 - 10;
}

// prettier-ignore
test("the panel stays inside the usable viewport at every mobile width", () => {
  for (const width of [280, 320, 360, 375, 390, 414, 480]) {
    installViewport({ width, height: 812, bottomNavTop: 740 });
    const style = anchoredPopoverGeometry(anchorRect({ right: bellRightFor(width), bottom: 56 }));

    assert.ok(style.left >= MARGIN, `left edge escaped at ${width}px: ${style.left}`);
    assert.ok(
      Number(style.left) + Number(style.width) <= width - MARGIN,
      `right edge escaped at ${width}px: ${Number(style.left) + Number(style.width)}`,
    );
    assert.ok(Number(style.maxHeight) >= 0, `negative max height at ${width}px`);
  }
});

// prettier-ignore
test("the reported left-clipping failure mode cannot recur at 320px", () => {
  // The previous notification CSS anchored right:0 to the bell and sized from the viewport,
  // which placed the left edge at roughly -42px here.
  installViewport({ width: 320, height: 720, bottomNavTop: 650 });
  const style = anchoredPopoverGeometry(anchorRect({ right: bellRightFor(320), bottom: 56 }));

  assert.equal(style.left, MARGIN);
  assert.equal(style.width, 320 - MARGIN * 2);
  assert.ok(Number(style.left) >= 0);
});

// prettier-ignore
test("max height stops above the bottom navigation", () => {
  installViewport({ width: 390, height: 812, bottomNavTop: 740 });
  const style = anchoredPopoverGeometry(anchorRect({ right: bellRightFor(390), bottom: 56 }));

  const top = Math.max(MARGIN, 56 + GAP);
  assert.equal(style.top, top);
  assert.equal(style.maxHeight, 740 - GAP - top);
});

// prettier-ignore
test("a cramped viewport clamps instead of returning a negative height", () => {
  installViewport({ width: 390, height: 200, bottomNavTop: 140 });
  const style = anchoredPopoverGeometry(anchorRect({ right: bellRightFor(390), bottom: 130 }));

  assert.equal(style.maxHeight, 0);
  assert.ok(Number(style.top) >= MARGIN);
});

// prettier-ignore
test("desktop keeps the preferred width and right-aligns to the anchor", () => {
  installViewport({ width: 1280, height: 900, bottomNavTop: 836 });
  const style = anchoredPopoverGeometry(anchorRect({ right: bellRightFor(1280), bottom: 56 }));

  assert.equal(style.width, 360);
  assert.equal(style.left, bellRightFor(1280) - 360);
});

// prettier-ignore
test("visual viewport offsets are honoured for Telegram-style insets", () => {
  installViewport({ width: 360, height: 640, offsetLeft: 100, offsetTop: 50, bottomNavTop: 600 });
  const style = anchoredPopoverGeometry(anchorRect({ right: 100 + bellRightFor(360), bottom: 106 }));

  assert.ok(Number(style.left) >= 100 + MARGIN);
  assert.ok(Number(style.left) + Number(style.width) <= 100 + 360 - MARGIN);
  assert.ok(Number(style.top) >= 50 + MARGIN);
  assert.equal(style.maxHeight, 600 - GAP - (106 + GAP));
});
