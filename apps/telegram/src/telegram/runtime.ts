export type TelegramBackButton = {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
};

type TelegramWebApp = {
  ready(): void;
  expand(): void;
  initData: string;
  colorScheme?: "light" | "dark";
  BackButton?: TelegramBackButton;
};

export interface TelegramRuntime {
  readonly initData: string;
  readonly colorScheme: "light" | "dark";
  readonly backButton: TelegramBackButton | null;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function initializeTelegramRuntime(): TelegramRuntime {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return { initData: "", colorScheme: "dark", backButton: null };
  webApp.ready();
  webApp.expand();
  return {
    initData: webApp.initData ?? "",
    colorScheme: webApp.colorScheme === "light" ? "light" : "dark",
    backButton: webApp.BackButton ?? null
  };
}
