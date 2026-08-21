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
  BackButton?: TelegramBackButton;
};

export interface TelegramRuntime {
  readonly initData: string;
  readonly backButton: TelegramBackButton | null;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function initializeTelegramRuntime(): TelegramRuntime {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return { initData: "", backButton: null };
  webApp.ready();
  webApp.expand();
  return {
    initData: webApp.initData ?? "",
    backButton: webApp.BackButton ?? null
  };
}
