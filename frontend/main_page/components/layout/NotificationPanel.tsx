"use client";

import { useTranslations } from "next-intl";
import type { NotificationItem } from "@/lib/notifications";
import NotificationMessage from "@/components/layout/NotificationMessage";

interface NotificationPanelProps {
  open: boolean;
  panelPosition: { top: number; left: number; width: number; arrowRight: number } | null;
  loading: boolean;
  loadingMore: boolean;
  notifications: NotificationItem[];
  listNeedsScroll: boolean;
  listScrollMaxHeight: number | null;
  panelRef: React.Ref<HTMLDivElement>;
  scrollRef: React.Ref<HTMLDivElement>;
  listRef: React.Ref<HTMLDivElement>;
  onMarkAllRead: () => void;
  onMarkRead: (id: number) => void;
  onScroll: () => void;
}

export default function NotificationPanel({
  open,
  panelPosition,
  loading,
  loadingMore,
  notifications,
  listNeedsScroll,
  listScrollMaxHeight,
  panelRef,
  scrollRef,
  listRef,
  onMarkAllRead,
  onMarkRead,
  onScroll,
}: NotificationPanelProps) {
  const t = useTranslations("notifications");

  if (!open || !panelPosition) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 overscroll-contain pt-1.5 font-app-body"
      style={{
        top: panelPosition.top,
        left: panelPosition.left,
        width: panelPosition.width,
      }}
    >
      <div
        className="absolute top-[1px] z-10"
        style={{ right: panelPosition.arrowRight }}
      >
        <div className="h-3 w-3 -rotate-45 rounded-[2px] border-r border-t border-[#b9cfe5] bg-white" />
      </div>

      <div className="relative w-full overflow-hidden overscroll-contain rounded-3xl bg-white shadow-[0px_20px_30px_0px_rgba(0,0,0,0.15)] outline outline-[1.2px] outline-offset-[-1.2px] outline-slate-300">
        <div className="flex h-20 items-center justify-between px-6">
          <h2 className="font-app-heading text-xl font-bold leading-8 text-sky-700">{t("title")}</h2>
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-sm font-medium leading-8 text-zinc-800/50 hover:text-zinc-800"
          >
            {t("markAllRead")}
          </button>
        </div>
        <div className="mx-3 h-px bg-zinc-800/10" />

        <div className="relative">
          <div
            ref={scrollRef}
            className={`overscroll-contain px-3 py-3 ${
              listNeedsScroll ? "overflow-y-auto" : "overflow-y-visible"
            }`}
            style={
              listScrollMaxHeight !== null
                ? {
                    maxHeight: `min(${listScrollMaxHeight}px, 60vh)`,
                    scrollbarWidth: "thin",
                    scrollbarColor: "#7A7A7A #E8E8E8",
                  }
                : undefined
            }
            onScroll={onScroll}
          >
            <div ref={listRef} className="space-y-3">
              {loading ? (
                <div
                  data-notification-item
                  className="flex min-h-[104px] w-full items-center justify-center rounded-[10px] px-4 py-4 text-center text-sm text-slate-400"
                >
                  {t("loading")}
                </div>
              ) : null}
              {!loading && notifications.length === 0 ? (
                <div
                  data-notification-item
                  className="flex min-h-[104px] w-full items-center justify-center rounded-[10px] px-4 py-4"
                >
                  <p className="text-center text-sm text-slate-400">{t("empty")}</p>
                </div>
              ) : null}
              {!loading &&
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    data-notification-item
                    role={notification.unread ? "button" : undefined}
                    tabIndex={notification.unread ? 0 : undefined}
                    onClick={() => onMarkRead(notification.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onMarkRead(notification.id);
                      }
                    }}
                    className={`flex w-full items-start gap-3 rounded-[10px] px-4 py-4 ${
                      notification.unread ? "bg-blue-50" : ""
                    } ${notification.unread ? "cursor-pointer" : ""}`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full px-2.5 ${notification.iconBgClass}`}
                    >
                      <img
                        src={notification.iconSrc}
                        alt={notification.iconAlt}
                        className={notification.iconImgClass}
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                      <div className="flex w-full items-center justify-between gap-3">
                        <h3 className="min-w-0 flex-1 text-base font-semibold text-zinc-800">
                          {notification.title}
                        </h3>
                        {notification.unread ? (
                          <img
                            src="/notification/unread.svg"
                            alt={t("unreadBadge")}
                            width={10}
                            height={10}
                            className="h-2 w-2 shrink-0"
                          />
                        ) : null}
                      </div>
                      <NotificationMessage notification={notification} />
                      <p className="w-full text-xs font-normal leading-4 text-slate-400">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                ))}
              {loadingMore ? (
                <p role="status" className="py-2 text-center text-xs text-slate-400">
                  {t("loadingMore")}
                </p>
              ) : null}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
