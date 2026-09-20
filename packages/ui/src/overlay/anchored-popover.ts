import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * Generic anchored-overlay presentation primitive.
 *
 * One implementation of collision-aware popover geometry for anchored top-layer surfaces.
 * It knows nothing about accounts, notifications, roles, counts or APIs: a caller supplies an
 * anchor element and an open flag and receives the refs plus the inline style that keep the
 * popover inside the usable viewport, above the bottom navigation, and vertically scrollable.
 */
const DEFAULT_MARGIN = 12;
const DEFAULT_GAP = 8;
const DEFAULT_MAX_WIDTH = 360;
const BOTTOM_NAV_SELECTOR = ".hooma-bottom-nav:not(.hooma-bottom-nav--hidden)";

/**
 * Grace period for pointer-leave auto-close. There is a physical gap between a trigger and its
 * top-layer popover, so closing immediately on leaving the trigger would flicker as the pointer
 * crosses that gap.
 */
const POINTER_LEAVE_CLOSE_DELAY_MS = 175;
const FINE_POINTER_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

export interface AnchoredPopoverOptions {
  readonly margin?: number;
  readonly gap?: number;
  readonly maxWidth?: number;
  readonly avoidSelector?: string;
}

export interface AnchoredPopoverPointerOptions {
  /**
   * Mouse/fine-pointer convenience only: once the popover has been opened by a pointer
   * interaction on the anchor, close it after the pointer has left both the anchor and the
   * popover for the grace delay. Keyboard-opened popovers, touch/coarse-pointer devices and
   * native light dismiss are unaffected. Enabled by default.
   */
  readonly closeOnPointerLeave?: boolean;
}

function supportsFinePointerHover(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(FINE_POINTER_HOVER_QUERY).matches;
  } catch {
    return false;
  }
}

function elementContains(element: Element | null, node: EventTarget | null): boolean {
  if (!element || !node) return false;
  const candidate = node as { contains?: (other: Node) => boolean };
  if (element === node) return true;
  if (typeof element.contains !== "function") return false;
  return typeof candidate.contains === "function" ? element.contains(node as Node) : false;
}

function pointerTarget(
  clientX: number,
  clientY: number,
  fallback: EventTarget | null,
): EventTarget | null {
  // Prefer real hit testing so crossing the trigger-to-popover gap is measured honestly; fall
  // back to the event target where hit testing is unavailable.
  if (typeof document.elementFromPoint === "function") {
    try {
      const under = document.elementFromPoint(clientX, clientY);
      if (under) return under;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function anchoredPopoverGeometry(
  anchor: HTMLElement,
  options: AnchoredPopoverOptions = {},
): CSSProperties {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const gap = options.gap ?? DEFAULT_GAP;
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const avoidSelector = options.avoidSelector ?? BOTTOM_NAV_SELECTOR;
  const visualViewport = window.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth = visualViewport?.width ?? window.innerWidth;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const anchorRect = anchor.getBoundingClientRect();
  const avoided = document.querySelector<HTMLElement>(avoidSelector);
  const avoidedRect = avoided?.getBoundingClientRect();
  const avoidedTop =
    avoidedRect && avoidedRect.top < viewportBottom && avoidedRect.bottom > viewportTop
      ? avoidedRect.top - gap
      : viewportBottom - margin;
  const bottomLimit = Math.min(viewportBottom - margin, avoidedTop);
  const width = Math.max(0, Math.min(maxWidth, viewportWidth - margin * 2));
  const left = Math.min(
    Math.max(viewportLeft + margin, anchorRect.right - width),
    viewportRight - margin - width,
  );
  const top = Math.max(viewportTop + margin, anchorRect.bottom + gap);

  return {
    top,
    left,
    width,
    maxHeight: Math.max(0, bottomLimit - top),
  };
}

export interface AnchoredPopoverBinding {
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  readonly popoverRef: RefObject<HTMLElement | null>;
  readonly style: CSSProperties;
}

export function useAnchoredPopover({
  open,
  onClose,
  revision,
  margin,
  gap,
  maxWidth,
  avoidSelector,
  closeOnPointerLeave = true,
}: AnchoredPopoverOptions &
  AnchoredPopoverPointerOptions & {
    readonly open: boolean;
    readonly onClose?: () => void;
    readonly revision?: unknown;
  }): AnchoredPopoverBinding {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pointerOpenedRef = useRef(false);
  const geometryOptions = useMemo<AnchoredPopoverOptions>(
    () => ({
      ...(margin === undefined ? {} : { margin }),
      ...(gap === undefined ? {} : { gap }),
      ...(maxWidth === undefined ? {} : { maxWidth }),
      ...(avoidSelector === undefined ? {} : { avoidSelector }),
    }),
    [margin, gap, maxWidth, avoidSelector],
  );

  useEffect(() => {
    // A pointer press on the anchor marks the next open as pointer-initiated. Keyboard
    // activation produces a click without a pointerdown, so keyboard behaviour stays untouched.
    function markPointerIntent(event: Event) {
      const pointerEvent = event as PointerEvent;
      if (pointerEvent.pointerType === "touch") return;
      if (elementContains(anchorRef.current, pointerEvent.target)) pointerOpenedRef.current = true;
    }

    document.addEventListener("pointerdown", markPointerIntent, true);
    return () => document.removeEventListener("pointerdown", markPointerIntent, true);
  }, []);

  useEffect(() => {
    if (!open) {
      pointerOpenedRef.current = false;
      return;
    }
    if (!closeOnPointerLeave) return;
    if (!pointerOpenedRef.current) return;
    if (!supportsFinePointerHover()) return;

    const anchorElement = anchorRef.current;
    let pendingClose: number | null = null;

    function cancelPendingClose() {
      if (pendingClose !== null) {
        window.clearTimeout(pendingClose);
        pendingClose = null;
      }
    }

    function evaluatePointer(event: Event) {
      const pointerEvent = event as PointerEvent;
      if (
        pointerEvent.pointerType &&
        pointerEvent.pointerType !== "mouse" &&
        pointerEvent.pointerType !== "pen"
      ) {
        return;
      }

      const target = pointerTarget(pointerEvent.clientX, pointerEvent.clientY, pointerEvent.target);
      const insideAnchor = elementContains(anchorElement, target);
      const insidePopover = elementContains(popoverRef.current, target);
      if (insideAnchor || insidePopover) {
        cancelPendingClose();
        return;
      }
      if (pendingClose === null) {
        pendingClose = window.setTimeout(() => {
          pendingClose = null;
          onCloseRef.current?.();
        }, POINTER_LEAVE_CLOSE_DELAY_MS);
      }
    }

    document.addEventListener("pointermove", evaluatePointer, true);
    document.addEventListener("pointerleave", evaluatePointer, true);
    return () => {
      document.removeEventListener("pointermove", evaluatePointer, true);
      document.removeEventListener("pointerleave", evaluatePointer, true);
      cancelPendingClose();
    };
  }, [closeOnPointerLeave, open]);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    function onToggle(event: Event) {
      const nextState = (event as Event & { newState?: string }).newState;
      if (nextState === "closed") onCloseRef.current?.();
    }

    popover.addEventListener("toggle", onToggle);
    return () => popover.removeEventListener("toggle", onToggle);
  }, [revision]);

  useEffect(() => {
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    if (!popover || !anchor) return;
    const anchorElement = anchor;

    if (!open) {
      if (popover.matches(":popover-open")) popover.hidePopover();
      return;
    }

    function updateGeometry() {
      setStyle(anchoredPopoverGeometry(anchorElement, geometryOptions));
    }

    updateGeometry();
    if (!popover.matches(":popover-open")) popover.showPopover();
    const frame = window.requestAnimationFrame(updateGeometry);
    const visualViewport = window.visualViewport;

    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);
    visualViewport?.addEventListener("resize", updateGeometry);
    visualViewport?.addEventListener("scroll", updateGeometry);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
      visualViewport?.removeEventListener("resize", updateGeometry);
      visualViewport?.removeEventListener("scroll", updateGeometry);
    };
  }, [geometryOptions, open, revision]);

  return { anchorRef, popoverRef, style };
}
