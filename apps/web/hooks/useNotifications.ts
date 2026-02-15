"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/types";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

interface UseNotificationsOptions {
  enabled: boolean;
  intervalMinutes: number;
}

export function useNotifications({ enabled, intervalMinutes }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await getNotifications(false, 20);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Silently fail — user might be logged out
    }
  }, [enabled]);

  // Poll at user's interval
  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refresh();
    const ms = Math.max(intervalMinutes, 1) * 60_000;
    timerRef.current = setInterval(refresh, ms);
    return () => clearInterval(timerRef.current);
  }, [enabled, intervalMinutes, refresh]);

  const markRead = useCallback(
    async (id: number) => {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    []
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}
