"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNotificationToasts } from "@/hooks/useNotificationToasts";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotificationEvents,
} from "@/services/notificationsApi";
import {
  mapNotification,
  measureNotificationListCap,
  NOTIFICATION_FALLBACK_ITEM_HEIGHT_PX,
  NOTIFICATION_LIST_GAP_PX,
  NOTIFICATION_LIST_PADDING_Y_PX,
  NOTIFICATION_PANEL_WIDTH,
  NOTIFICATION_VISIBLE_LIMIT,
  type NotificationItem,
} from "@/lib/notifications";

export function useNotifications(activeTab: string | null) {
  const tNotifications = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const { toasts, observeNotifications, dismissToast } = useNotificationToasts(open);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const refreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const cursorRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [listMaxHeight, setListMaxHeight] = useState<number | null>(null);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
    arrowRight: number;
  } | null>(null);
  const mapRow = useCallback(
    (row: Parameters<typeof mapNotification>[0]) => mapNotification(row, tNotifications),
    [tNotifications],
  );

  const refreshNotifications = useCallback(async function refresh(showLoading = false) {
    if (refreshingRef.current) {
      refreshAgainRef.current = true;
      return;
    }
    refreshingRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const { notifications: rows, unread_count } = await fetchNotifications();
      const mappedRows = rows.map(mapRow);
      observeNotifications(mappedRows);
      setUnreadCount(unread_count);
      setNotifications((current) => {
        const currentById = new Map(current.map((item) => [item.id, item] as const));
        const latest = mappedRows.map((mapped) => {
          const existing = currentById.get(mapped.id);
          return existing && !existing.unread
            ? { ...mapped, unread: false }
            : mapped;
        });
        const latestIds = new Set(latest.map((item) => item.id));
        return [...latest, ...current.filter((item) => !latestIds.has(item.id))];
      });
      if (cursorRef.current === null) {
        if (rows.length > 0) cursorRef.current = rows[rows.length - 1].id;
        hasMoreRef.current = rows.length === 20;
        setHasMore(hasMoreRef.current);
      }
    } catch {
      // Keep the current feed visible when a background refresh fails.
    } finally {
      refreshingRef.current = false;
      if (showLoading) setLoading(false);
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false;
        void refresh();
      }
    }
  }, [mapRow, observeNotifications]);

  const loadMoreNotifications = useCallback(async () => {
    if (!hasMoreRef.current || loadingMoreRef.current || cursorRef.current === null) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { notifications: rows } = await fetchNotifications(20, cursorRef.current);
      const older = rows.map(mapRow);
      if (rows.length > 0) cursorRef.current = rows[rows.length - 1].id;
      hasMoreRef.current = rows.length === 20;
      setHasMore(hasMoreRef.current);
      setNotifications((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...older.filter((item) => !existingIds.has(item.id))];
      });
    } catch {
      // Keep the current feed available and retry when the user scrolls again.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [mapRow]);

  const updateListHeight = useCallback(() => {
    const listRoot = listRef.current;
    if (!listRoot) return;
    setListMaxHeight(measureNotificationListCap(listRoot));
  }, []);

  const updatePanelPosition = useCallback(() => {
    const bellEl = bellRef.current;
    const alignEl =
      document.querySelector<HTMLElement>("[data-brainpower-panel]") ??
      document.querySelector<HTMLElement>("main");
    if (!bellEl || !alignEl) return;

    const alignRect = alignEl.getBoundingClientRect();
    const bellRect = bellEl.getBoundingClientRect();
    const panelWidth = Math.min(NOTIFICATION_PANEL_WIDTH, window.innerWidth - 32);
    const left = Math.max(16, Math.round(alignRect.right - panelWidth));
    const top = Math.round(bellRect.bottom + 8);
    const bellCenterX = bellRect.left + bellRect.width / 2;
    const panelRight = left + panelWidth;
    const arrowRight = Math.round(panelRight - bellCenterX - 6);

    setPanelPosition({ top, left, width: panelWidth, arrowRight });
  }, []);

  const hasUnread = unreadCount > 0;
  const listNeedsScroll =
    !loading && (notifications.length > NOTIFICATION_VISIBLE_LIMIT || hasMore);
  const listScrollMaxHeight =
    listMaxHeight !== null
      ? listMaxHeight + NOTIFICATION_LIST_PADDING_Y_PX
      : listNeedsScroll
        ? NOTIFICATION_VISIBLE_LIMIT * NOTIFICATION_FALLBACK_ITEM_HEIGHT_PX +
          (NOTIFICATION_VISIBLE_LIMIT - 1) * NOTIFICATION_LIST_GAP_PX +
          NOTIFICATION_LIST_PADDING_Y_PX
        : null;

  const markAsRead = useCallback(
    (notificationId: number) => {
      const target = notifications.find((n) => n.id === notificationId);
      if (!target?.unread) return;
      setNotifications((current) =>
        current.map((n) => (n.id === notificationId ? { ...n, unread: false } : n)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationRead(notificationId).catch(() => {
        setNotifications((current) =>
          current.map((n) => (n.id === notificationId ? { ...n, unread: true } : n)),
        );
        setUnreadCount((count) => count + 1);
      });
    },
    [notifications],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {
      void refreshNotifications();
    });
  }, [refreshNotifications]);

  const handleListScroll = useCallback(() => {
    const element = scrollRef.current;
    if (
      element &&
      hasMoreRef.current &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 160
    ) {
      void loadMoreNotifications();
    }
  }, [loadMoreNotifications]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshNotifications();
      }
    };

    let fallbackInterval: number | null = null;
    const setFallbackPolling = (enabled: boolean) => {
      if (enabled && fallbackInterval === null) {
        fallbackInterval = window.setInterval(refreshIfVisible, 30_000);
      } else if (!enabled && fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    void refreshNotifications(true);
    const eventSource = subscribeToNotificationEvents(
      refreshIfVisible,
      (connected) => {
        setFallbackPolling(!connected);
        if (connected) refreshIfVisible();
      },
    );
    if (!eventSource) setFallbackPolling(true);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      eventSource?.close();
      setFallbackPolling(false);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refreshNotifications]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null);
      setListMaxHeight(null);
      return;
    }

    const measureLayout = () => {
      updatePanelPosition();
      updateListHeight();
    };

    measureLayout();
    const raf1 = requestAnimationFrame(() => {
      measureLayout();
      requestAnimationFrame(measureLayout);
    });

    return () => cancelAnimationFrame(raf1);
  }, [open, activeTab, notifications, loading, updatePanelPosition, updateListHeight]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    const el = scrollRef.current;
    const listRoot = listRef.current;
    const scrollObserver =
      el || listRoot
        ? new ResizeObserver(() => {
            updateListHeight();
            updatePanelPosition();
          })
        : null;
    if (el && scrollObserver) scrollObserver.observe(el);
    if (listRoot && scrollObserver) scrollObserver.observe(listRoot);

    const onLayoutChange = () => {
      updatePanelPosition();
    };
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);

    return () => {
      scrollObserver?.disconnect();
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, notifications, loading, updatePanelPosition, updateListHeight]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return {
    toasts,
    dismissToast,
    open,
    setOpen,
    notifications,
    loading,
    loadingMore,
    hasUnread,
    listNeedsScroll,
    listScrollMaxHeight,
    hasMore,
    panelPosition,
    containerRef,
    bellRef,
    listRef,
    panelRef,
    scrollRef,
    markAsRead,
    markAllRead,
    handleListScroll,
  };
}
