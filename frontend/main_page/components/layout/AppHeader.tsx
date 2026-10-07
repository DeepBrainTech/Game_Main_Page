"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n-navigation";
import { type MembershipPlan } from "@/components/features/membership/MembershipPlans";
import BalanceBadge from "@/components/layout/BalanceBadge";
import CoinHelpPopover from "@/components/layout/CoinHelpPopover";
import DiamondHelpPopover from "@/components/layout/DiamondHelpPopover";
import NotificationPanel from "@/components/layout/NotificationPanel";
import { buildAppShellTabs, type AppShellTabItem } from "@/components/layout/appShellTabs";
import type { AppTab } from "@/components/layout/appShellTypes";
import type { useNotifications } from "@/hooks/useNotifications";

type NotificationState = ReturnType<typeof useNotifications>;

interface AppHeaderProps {
  activeTab: AppTab | null;
  tabHrefMap: Record<AppTab, string>;
  membershipPlan: MembershipPlan;
  rewardsLoading: boolean;
  coins: number;
  diamonds: number;
  flowers: number;
  resolvedAvatarSrc: string;
  onAvatarError: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onCloseOverlays: () => void;
  onBeforeToggleNotifications: () => void;
  notifications: NotificationState;
}

export default function AppHeader({
  activeTab,
  tabHrefMap,
  membershipPlan,
  rewardsLoading,
  coins,
  diamonds,
  flowers,
  resolvedAvatarSrc,
  onAvatarError,
  onOpenProfile,
  onOpenSettings,
  onCloseOverlays,
  onBeforeToggleNotifications,
  notifications,
}: AppHeaderProps) {
  const tNav = useTranslations("nav");
  const tHome = useTranslations("dashboard");
  const tMembership = useTranslations("membership");
  const tCommon = useTranslations("common");
  const tabs: AppShellTabItem[] = buildAppShellTabs(tNav, tHome);

  const toggleNotifications = () => {
    onBeforeToggleNotifications();
    notifications.setOpen((open) => !open);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-2 px-4 py-3 sm:min-h-[4.75rem] sm:gap-3 sm:px-6 sm:py-3.5 lg:min-h-24 lg:px-8 lg:py-4">
        <div className="flex min-w-0 items-center">
          <Image
            src="/dashboard/logo.png"
            alt={tCommon("appName")}
            width={220}
            height={64}
            className="h-8 w-auto max-w-full object-contain sm:h-10 lg:h-12"
            priority
          />
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 xl:max-w-[759px]">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-2 md:gap-3">
            <div className="group relative">
              <button type="button" className="rounded-full" aria-label={tHome("coins")}>
                <BalanceBadge
                  iconSrc="/dashboard/coin.svg"
                  iconAlt={tHome("coins")}
                  value={coins}
                  variant="coin"
                  highlight
                  ready={!rewardsLoading}
                />
              </button>
              <div className="pointer-events-none invisible absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 opacity-0 transition duration-200 group-hover:visible group-hover:opacity-100">
                <CoinHelpPopover />
              </div>
            </div>
            <div className="group relative">
              <button type="button" className="rounded-full" aria-label={tHome("diamonds")}>
                <BalanceBadge
                  iconSrc="/dashboard/dimond.svg"
                  iconAlt={tHome("diamonds")}
                  value={diamonds}
                  variant="diamond"
                  highlight
                  ready={!rewardsLoading}
                />
              </button>
              <div className="pointer-events-none invisible absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 opacity-0 transition duration-200 group-hover:visible group-hover:opacity-100">
                <DiamondHelpPopover />
              </div>
            </div>
            <BalanceBadge
              iconSrc="/dashboard/flower.svg"
              iconAlt={tHome("flowers")}
              value={flowers}
              variant="flower"
              highlight
              ready={!rewardsLoading}
            />
          </div>

          <Link
            href="/shop"
            onClick={onCloseOverlays}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl text-sky-700 hover:bg-indigo-100 sm:h-10 sm:w-10 sm:text-2xl md:h-11 md:w-11"
            aria-label={tNav("shop")}
          >
            <img src="/dashboard/shop.svg" alt="" width={20} height={20} className="h-5 w-5" />
          </Link>

          <div ref={notifications.containerRef} className="relative shrink-0">
            <button
              ref={notifications.bellRef}
              type="button"
              onClick={toggleNotifications}
              className="relative inline-flex size-9 shrink-0 flex-col items-start justify-start rounded-xl bg-indigo-50 px-2 pt-2 text-sky-700 hover:bg-indigo-100 sm:size-10 sm:px-2.5 sm:pt-2.5 md:size-11 md:px-3 md:pt-3"
              aria-label={tNav("notifications")}
              aria-expanded={notifications.open}
            >
              <div className="relative size-5 shrink-0">
                <img src="/notification/mail.svg" alt="" width={15} height={15} className="h-5 w-5" />
                {notifications.hasUnread ? (
                  <img
                    src="/notification/unread.svg"
                    alt=""
                    width={10}
                    height={10}
                    className="absolute bottom-0 right-0 h-2 w-2 translate-x-[2px] translate-y-[-1px]"
                    aria-hidden
                  />
                ) : null}
              </div>
            </button>

            <NotificationPanel
              open={notifications.open}
              panelPosition={notifications.panelPosition}
              loading={notifications.loading}
              loadingMore={notifications.loadingMore}
              notifications={notifications.notifications}
              listNeedsScroll={notifications.listNeedsScroll}
              listScrollMaxHeight={notifications.listScrollMaxHeight}
              panelRef={notifications.panelRef}
              scrollRef={notifications.scrollRef}
              listRef={notifications.listRef}
              onMarkAllRead={notifications.markAllRead}
              onMarkRead={notifications.markAsRead}
              onScroll={notifications.handleListScroll}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onCloseOverlays();
              onOpenSettings();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl text-sky-700 hover:bg-indigo-100 sm:h-10 sm:w-10 sm:text-2xl md:h-11 md:w-11"
            aria-label={tNav("settings")}
          >
            {"\u2699"}
          </button>

          <Link
            href="/membership"
            className="shrink-0 transition hover:scale-105"
            aria-label={tMembership("statusLabel", { plan: tMembership(`plans.${membershipPlan}`) })}
          >
            <Image
              src={`/membership/${membershipPlan}.png`}
              alt=""
              width={150}
              height={50}
              className="h-4 w-auto object-contain sm:h-2 md:h-4"
            />
          </Link>

          <button
            type="button"
            onClick={() => {
              onCloseOverlays();
              onOpenProfile();
            }}
            className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white sm:h-10 sm:w-10 md:h-11 md:w-11"
            aria-label={tNav("profile")}
          >
            <img
              src={resolvedAvatarSrc}
              alt={tNav("profile")}
              className="h-full w-full object-cover"
              onError={onAvatarError}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
        {tabs.map(({ key, label, iconSrc, iconAlt }) => {
          const isActive = activeTab === key;
          return (
          <Link
            key={key}
            href={tabHrefMap[key]}
            prefetch
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              isActive ? "bg-[#E45C44] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Image
                src={iconSrc}
                alt={iconAlt}
                width={14}
                height={14}
                className={`h-3.5 w-3.5 ${isActive ? "brightness-0 invert" : ""}`}
              />
              <span>{label}</span>
            </span>
          </Link>
          );
        })}
      </div>
    </header>
  );
}
