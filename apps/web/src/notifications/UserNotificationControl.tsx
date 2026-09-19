import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend, type UserNotificationItem } from "@hooma/frontend";

function notificationTitle(item: UserNotificationItem): string {
  if (item.type === "MODERATION_YELLOW_CARD") return "Yellow card warning";
  if (item.type === "MODERATION_SECOND_YELLOW_CARD") return "Second yellow card warning";
  if (item.type === "MODERATION_RED_CARD_BAN") return "Red card — banned for one week";
  if (item.type === "MODERATION_TEMPORARY_BAN") return "Temporary ban";
  if (item.type === "MODERATION_READ_ONLY") return "Read-only restriction";
  if (item.type === "MODERATION_ACCOUNT_DISABLED") return "Account disabled";
  if (item.type === "RIDE_WHISTLE") return "New ride whistle";
  return "New whistle";
}

function notificationDetail(item: UserNotificationItem): string {
  if (item.expiresAt) return `Until ${new Date(item.expiresAt).toLocaleString()}`;
  if (item.type === "MODERATION_YELLOW_CARD") return "First strike";
  if (item.type === "MODERATION_SECOND_YELLOW_CARD") return "Second strike";
  if (item.type === "MODERATION_RED_CARD_BAN") return "Third strike";
  return new Date(item.createdAt).toLocaleString();
}

export function UserNotificationControl({ enabled }: { readonly enabled: boolean }) {
  const { api } = useHoomaFrontend();
  const [items, setItems] = useState<readonly UserNotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!enabled) return;
    try {
      const page = await api.notifications.list();
      setItems(page.items);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setOpen(false);
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [api, enabled]);

  const unreadCount = useMemo(() => items.filter((item) => item.readAt === null).length, [items]);

  async function markRead(item: UserNotificationItem) {
    if (item.readAt !== null) return;
    await api.notifications.markRead(item.id);
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ),
    );
  }

  if (!enabled) return null;

  return (
    <div className="hooma-notification-control">
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
        <section className="hooma-notification-popover" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            <span>{unreadCount} unread</span>
          </header>
          <div className="hooma-notification-list">
            {items.length ? (
              items.map((item) => (
                <button
                  className="hooma-notification-item"
                  data-unread={item.readAt === null ? "true" : "false"}
                  type="button"
                  key={item.id}
                  onClick={() => void markRead(item)}
                >
                  <strong>{notificationTitle(item)}</strong>
                  <span>{notificationDetail(item)}</span>
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
