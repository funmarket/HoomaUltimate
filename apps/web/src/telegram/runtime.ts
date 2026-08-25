export type TelegramBackButton = {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
};

type TelegramInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type TelegramEventType =
  | "themeChanged"
  | "viewportChanged"
  | "safeAreaChanged"
  | "contentSafeAreaChanged";

type TelegramEventHandler = (payload?: unknown) => void;

type TelegramWebApp = {
  ready(): void;
  expand(): void;
  initData?: string;
  colorScheme?: "light" | "dark";
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInsets;
  contentSafeAreaInset?: TelegramInsets;
  BackButton?: TelegramBackButton;
  onEvent?(eventType: TelegramEventType, handler: TelegramEventHandler): void;
  offEvent?(eventType: TelegramEventType, handler: TelegramEventHandler): void;
};

export type TelegramRuntime = {
  readonly initData: string;
  readonly colorScheme: "light" | "dark" | null;
  readonly backButton: TelegramBackButton | null;
  connect(): () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const RUNTIME_LAYOUT_PROPERTIES = [
  "--hooma-viewport-height",
  "--hooma-viewport-stable-height",
  "--hooma-safe-area-inset-top",
  "--hooma-safe-area-inset-bottom",
  "--hooma-safe-area-inset-left",
  "--hooma-safe-area-inset-right",
  "--hooma-content-safe-area-inset-top",
  "--hooma-content-safe-area-inset-bottom",
  "--hooma-content-safe-area-inset-left",
  "--hooma-content-safe-area-inset-right",
] as const;

function colorScheme(webApp: TelegramWebApp | undefined): "light" | "dark" | null {
  return webApp?.colorScheme === "light" || webApp?.colorScheme === "dark"
    ? webApp.colorScheme
    : null;
}

function pixels(value: number | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${value}px` : null;
}

function setLength(root: HTMLElement, property: string, value: number | undefined): void {
  const next = pixels(value);
  if (next) root.style.setProperty(property, next);
  else root.style.removeProperty(property);
}

function syncInsets(root: HTMLElement, prefix: string, insets: TelegramInsets | undefined): void {
  setLength(root, `${prefix}-top`, insets?.top);
  setLength(root, `${prefix}-bottom`, insets?.bottom);
  setLength(root, `${prefix}-left`, insets?.left);
  setLength(root, `${prefix}-right`, insets?.right);
}

function clearRuntimeLayout(root: HTMLElement): void {
  for (const property of RUNTIME_LAYOUT_PROPERTIES) root.style.removeProperty(property);
  delete root.dataset.telegramRuntime;
  delete root.dataset.telegramColorScheme;
}

export function createTelegramRuntime(): TelegramRuntime {
  const webApp = window.Telegram?.WebApp;

  return {
    initData: webApp?.initData ?? "",
    get colorScheme() {
      return colorScheme(webApp);
    },
    backButton: webApp?.BackButton ?? null,
    connect() {
      if (!webApp) return () => undefined;

      const root = document.documentElement;
      root.dataset.telegramRuntime = "active";

      const syncViewport = () => {
        const viewportHeight =
          pixels(webApp.viewportHeight) !== null ? webApp.viewportHeight : window.innerHeight;
        const stableHeight =
          pixels(webApp.viewportStableHeight) !== null
            ? webApp.viewportStableHeight
            : viewportHeight;
        setLength(root, "--hooma-viewport-height", viewportHeight);
        setLength(root, "--hooma-viewport-stable-height", stableHeight);
      };
      const syncSafeArea = () =>
        syncInsets(root, "--hooma-safe-area-inset", webApp.safeAreaInset);
      const syncContentSafeArea = () =>
        syncInsets(root, "--hooma-content-safe-area-inset", webApp.contentSafeAreaInset);
      const syncTheme = () => {
        const scheme = colorScheme(webApp);
        if (scheme) root.dataset.telegramColorScheme = scheme;
        else delete root.dataset.telegramColorScheme;
      };

      webApp.ready();
      webApp.expand();
      syncViewport();
      syncSafeArea();
      syncContentSafeArea();
      syncTheme();

      const handlers: readonly [TelegramEventType, TelegramEventHandler][] = [
        ["viewportChanged", syncViewport],
        ["safeAreaChanged", syncSafeArea],
        ["contentSafeAreaChanged", syncContentSafeArea],
        ["themeChanged", syncTheme],
      ];

      if (webApp.onEvent && webApp.offEvent) {
        for (const [eventType, handler] of handlers) webApp.onEvent(eventType, handler);
      }

      return () => {
        if (webApp.onEvent && webApp.offEvent) {
          for (const [eventType, handler] of handlers) webApp.offEvent(eventType, handler);
        }
        clearRuntimeLayout(root);
      };
    },
  };
}
