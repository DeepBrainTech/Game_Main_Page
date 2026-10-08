"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { NotificationItem } from "@/lib/notifications";
import { NOTIFICATION_TOAST_DURATION_MS } from "@/lib/notifications";
import { useToastAutoDismiss } from "@/hooks/useToastAutoDismiss";
import NotificationMessage from "./NotificationMessage";
import styles from "./NotificationToast.module.css";

const EXIT_DURATION_MS = 320;

interface NotificationToastProps {
  notification: NotificationItem;
  onDismiss: () => void;
  onOpen: () => void;
}

export default function NotificationToast({ notification, onDismiss, onOpen }: NotificationToastProps) {
  const t = useTranslations("notifications");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const startDismiss = () => setExiting(true);
  useToastAutoDismiss(NOTIFICATION_TOAST_DURATION_MS, hovered || focused || exiting, startDismiss);

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(() => onDismissRef.current(), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  return (
    <div
      className={styles.toastSlot}
      data-exiting={exiting}
      style={{ "--toast-exit-duration": `${EXIT_DURATION_MS}ms` } as React.CSSProperties}
    >
      <div className={styles.toastClip}>
        <div className={styles.toastSpacing}>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`${styles.toast} pointer-events-auto flex min-w-0 rounded-2xl border border-slate-200 bg-white font-app-body shadow-[0_4px_12px_rgba(0,0,0,0.12)]`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                startDismiss();
              }
            }}
          >
            <button
              type="button"
              onClick={onOpen}
              disabled={exiting}
              aria-label={t("openToast", { title: notification.title })}
              className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-4 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-700"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${notification.iconBgClass}`}>
                <img src={notification.iconSrc} alt="" className={notification.iconImgClass} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 break-words">
                <span className="text-base font-semibold text-zinc-800">{notification.title}</span>
                <NotificationMessage notification={notification} />
                <span className="text-xs text-slate-400">{notification.time}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={startDismiss}
              disabled={exiting}
              aria-label={t("dismissToast")}
              className="mr-2 mt-2 flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
