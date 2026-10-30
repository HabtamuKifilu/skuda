"use client";

import { Bell, Check, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function NotificationCenter({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/notifications?limit=30`,
        { cache: "no-store", signal },
      );

      if (!response.ok) throw new Error("Unable to load notifications");

      const data = (await response.json()) as NotificationResponse;
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [schoolId]);

  async function markRead(notification: NotificationItem) {
    if (notification.readAt || pendingIds.includes(notification.id)) return;

    setPendingIds((current) => [...current, notification.id]);

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/notifications/${encodeURIComponent(notification.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        },
      );

      if (!response.ok) throw new Error("Unable to update notification");

      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError(true);
    } finally {
      setPendingIds((current) => current.filter((id) => id !== notification.id));
    }
  }

  async function openNotification(notification: NotificationItem) {
    await markRead(notification);
    setOpen(false);

    if (notification.href?.startsWith("/") && !notification.href.startsWith("//")) {
      router.push(notification.href);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="school-notification-panel"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void refresh();
        }}
      >
        <Bell className="size-[18px]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <section
            id="school-notification-panel"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Notifications</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {unreadCount} unread
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                aria-label="Refresh notifications"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">Refresh</span>
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="text-xs text-destructive">Could not update notifications.</p>
                <button
                  type="button"
                  className="text-xs font-medium text-primary"
                  onClick={() => void refresh()}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading notifications…
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  You’re all caught up.
                </p>
              ) : (
                items.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 ${
                      notification.readAt ? "" : "bg-primary/[0.035]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 size-2 shrink-0 rounded-full ${
                            notification.readAt ? "bg-muted-foreground/25" : "bg-primary"
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5">
                            {notification.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {notification.message}
                          </span>
                          <span className="mt-1.5 block text-[11px] text-muted-foreground">
                            {new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(notification.createdAt))}
                          </span>
                        </span>
                      </span>
                    </button>

                    {!notification.readAt && (
                      <button
                        type="button"
                        aria-label={`Mark "${notification.title}" as read`}
                        title="Mark as read"
                        disabled={pendingIds.includes(notification.id)}
                        onClick={() => void markRead(notification)}
                        className="flex size-8 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
