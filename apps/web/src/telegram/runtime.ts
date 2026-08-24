export type TelegramBackButton = {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
};

type TelegramWebApp = {
  ready(): void;
  expand(): void;
  initData?: string;
  colorScheme?: "light" | "dark";
  BackButton?: TelegramBackButton;
};

export type TelegramRuntime = {
  readonly initData: string;
  readonly colorScheme: "light" | "dark" | null;
  readonly backButton: TelegramBackButton | null;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function initializeTelegramRuntime(): TelegramRuntime {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return { initData: "", colorScheme: null, backButton: null };

  webApp.ready();
  webApp.expand();

  return {
    initData: webApp.initData ?? "",
    colorScheme:
      webApp.colorScheme === "light" || webApp.colorScheme === "dark" ? webApp.colorScheme : null,
    backButton: webApp.BackButton ?? null,
  };
}
