"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useTranslations } from "next-intl";
import type { NotificationItem } from "@/lib/notifications";
import NotificationToast from "./NotificationToast";

interface NotificationToastStackProps {
  notifications: NotificationItem[];
  bellRef: RefObject<HTMLButtonElement>;
  onDismiss: (id: number) => void;
  onOpen: (id: number) => void;
}

export default function NotificationToastStack({ notifications, bellRef, onDismiss, onOpen }: NotificationToastStackProps) {
  const t = useTranslations("notifications");
  const [top, setTop] = useState(112);

  useEffect(() => {
    const header = bellRef.current?.closest("header");
    if (!header) return;

    const updatePosition = () => setTop(Math.max(12, header.getBoundingClientRect().bottom + 12));
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(header);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [bellRef]);

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="pointer-events-none fixed inset-x-2 z-[60] flex max-h-[calc(100dvh_-_1rem_-_var(--toast-top))] flex-col overflow-y-auto overscroll-contain sm:left-auto sm:right-4 sm:w-[min(27rem,calc(100%_-_2rem))]"
      style={{ top, "--toast-top": `${top}px` } as CSSProperties}
    >
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
          onOpen={() => onOpen(notification.id)}
        />
      ))}
    </div>
  );
}
