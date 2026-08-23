import { initializeTelegramRuntime } from "../telegram/runtime";
import { applyTelegramAppearanceMode, getTelegramAppearanceMode } from "../settings/theme";
import { TelegramRouter } from "./router/TelegramRouter";
const runtime = initializeTelegramRuntime();
applyTelegramAppearanceMode(getTelegramAppearanceMode(), runtime.colorScheme);
export function TelegramApp() { if (!runtime.initData) return <main className="foundation-shell"><section className="status"><p className="eyebrow">TELEGRAM MINI APP</p><h1>Open HOOMA from Telegram</h1><p>This entry requires a verified Telegram Mini App launch so Telegram can securely provide your account identity.</p></section></main>; return <TelegramRouter runtime={runtime} />; }
