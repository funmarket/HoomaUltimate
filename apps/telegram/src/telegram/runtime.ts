type TelegramWebApp = {
  ready(): void;
  expand(): void;
  initData: string;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function initializeTelegramRuntime(): { initData: string } {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return { initData: "" };
  webApp.ready();
  webApp.expand();
  return { initData: webApp.initData ?? "" };
}
