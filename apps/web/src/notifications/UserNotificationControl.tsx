import { useEffect, useState } from "react";
import type { PasswordRecoveryCodeResponse } from "@hooma/contracts/auth-recovery";
import { useHoomaFrontend, type UserNotificationItem } from "@hooma/frontend";
import { useAnchoredPopover } from "@hooma/ui";

function notificationTitle(item: UserNotificationItem): string {
  if (item.type === "PASSWORD_RECOVERY") return "Password recovery";
  if (item.type === "MODERATION_YELLOW_CARD") return "Yellow card warning";
  if (item.type === "MODERATION_SECOND_YELLOW_CARD") return "Second yellow card warning";
  if (item.type === "MODERATION_RED_CARD_BAN") return "Red card — banned for one week";
  if (item.type === "MODERATION_TEMPORARY_BAN") return "Temporary ban";
  if (item.type === "MODERATION_READ_ONLY") return "Read-only restriction";
  if (item.type === "MODERATION_ACCOUNT_DISABLED") return "Account disabled";
  if (item.type === "MODERATION_SANCTION_CLEARED") return "Sanction cleared";
  if (item.type === "RIDE_WHISTLE") return "New ride whistle";
  return "New whistle";
}

function notificationDetail(
  item: UserNotificationItem,
  recovery: PasswordRecoveryCodeResponse | undefined,
  telegramRuntime: boolean,
): string {
  if (item.type === "PASSWORD_RECOVERY") {
    if (recovery) {
      return `Recovery code: ${recovery.code} · Expires ${new Date(
        recovery.expiresAt,
      ).toLocaleTimeString()}`;
    }
    return telegramRuntime
      ? "Tap to view your one-time Web password recovery code"
      : "Open HOOMA in Telegram to view your recovery code";
  }
  if (item.type === "MODERATION_SANCTION_CLEARED") {
    return `Lifted ${new Date(item.createdAt).toLocaleString()}`;
  }
  if (item.expiresAt) return `Until ${new Date(item.expiresAt).toLocaleString()}`;
  if (item.type === "MODERATION_YELLOW_CARD") return "First strike";
  if (item.type === "MODERATION_SECOND_YELLOW_CARD") return "Second strike";
  if (item.type === "MODERATION_RED_CARD_BAN") return "Third strike";
  return new Date(item.createdAt).toLocaleString();
}

export function UserNotificationControl({
  enabled,
  telegramRuntime = false,
}: {
  readonly enabled: boolean;
  readonly telegramRuntime?: boolean;
}) {
  const { api } = useHoomaFrontend();
  const [items, setItems] = useState<readonly UserNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<
    Readonly<Record<string, PasswordRecoveryCodeResponse>>
  >({});
  const [actionError, setActionError] = useState("");
  const { anchorRef, popoverRef, style } = useAnchoredPopover({
    open,
    onClose: () => setOpen(false),
  });

  async function load() {
    if (!enabled) return;
    try {
      const page = await api.notifications.list();
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      setOpen(false);
      setRecoveryCodes({});
      setActionError("");
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [api, enabled]);

  async function markRead(item: UserNotificationItem) {
    if (item.readAt !== null) return;
    try {
      await api.notifications.markRead(item.id);
    } catch {
      void load();
      return;
    }
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  async function selectNotification(item: UserNotificationItem) {
    setActionError("");
    if (item.type !== "PASSWORD_RECOVERY") {
      await markRead(item);
      return;
    }
    if (recoveryCodes[item.id]) return;
    if (!telegramRuntime) {
      setActionError("Open HOOMA in Telegram to view this recovery code.");
      return;
    }
    try {
      const recovery = await api.identity.passwordRecoveryCodeFromNotification(item.id);
      setRecoveryCodes((current) => ({ ...current, [item.id]: recovery }));
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      );
      if (item.readAt === null) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to open recovery code");
    }
  }

  if (!enabled) return null;

  return (
    <div className="hooma-notification-control" ref={anchorRef}>
      <button
        className="hooma-notification-trigger"
        type="button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 ? <span className="hooma-notification-count">{unreadCount}</span> : null}
      </button>
      {open ? (
        <section
          ref={popoverRef}
          className="hooma-notification-popover"
          aria-label="Notifications"
          popover="auto"
          style={style}
        >
          <header>
            <strong>Notifications</strong>
            <span>{unreadCount} unread</span>
          </header>
          {actionError ? <p className="error">{actionError}</p> : null}
          <div className="hooma-notification-list">
            {items.length ? (
              items.map((item) => (
                <button
                  className="hooma-notification-item"
                  data-unread={item.readAt === null ? "true" : "false"}
                  type="button"
                  key={item.id}
                  onClick={() => void selectNotification(item)}
                >
                  <strong>{notificationTitle(item)}</strong>
                  <span>{notificationDetail(item, recoveryCodes[item.id], telegramRuntime)}</span>
                </button>
              ))
            ) : (
              <p>No notifications yet.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
