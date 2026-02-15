"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onClickNotification: (notification: NotificationItem) => void;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClickNotification,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (notif: NotificationItem) => {
    if (!notif.is_read) onMarkRead(notif.id);
    onClickNotification(notif);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-7 h-7 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        {/* Bell SVG */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5.5a4 4 0 0 0-8 0c0 4.5-2 5.5-2 5.5h12s-2-1-2-5.5" />
          <path d="M9.15 13a1.3 1.3 0 0 1-2.3 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] font-bold bg-[var(--color-bg-inverse)] text-white rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[340px] bg-white border border-[var(--color-border)] shadow-lg z-50 max-h-[420px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1.5 text-[var(--color-text-primary)]">({unreadCount})</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[10px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--color-text-tertiary)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)] ${
                    !notif.is_read ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0">
                      {!notif.is_read ? (
                        <div className="w-2 h-2 rounded-full bg-[var(--color-bg-inverse)]" />
                      ) : (
                        <div className="w-2 h-2" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug">
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1">
                          {notif.body}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                        {notif.category && (
                          <span className="uppercase font-semibold tracking-wider">
                            {notif.category}
                          </span>
                        )}
                        <span>{timeAgo(notif.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
