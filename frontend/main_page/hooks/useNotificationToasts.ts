"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/lib/notifications";
import { NOTIFICATION_TOAST_VISIBLE_LIMIT } from "@/lib/notifications";

export function useNotificationToasts(panelOpen: boolean) {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const latestIdRef = useRef<number | null>(null);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  const observeNotifications = useCallback((items: NotificationItem[]) => {
    const previousId = latestIdRef.current;
    latestIdRef.current = Math.max(previousId ?? 0, ...items.map((item) => item.id));

    // The first successful fetch establishes a baseline without replaying history.
    if (previousId === null || panelOpenRef.current) return;

    const incoming = items
      .filter((item) => item.id > previousId && item.unread)
      .sort((a, b) => a.id - b.id);
    if (incoming.length > 0) setQueue((current) => [...current, ...incoming]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (panelOpen) setQueue([]);
  }, [panelOpen]);

  return {
    toasts: panelOpen ? [] : queue.slice(0, NOTIFICATION_TOAST_VISIBLE_LIMIT),
    observeNotifications,
    dismissToast,
  };
}
