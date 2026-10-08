"use client";

import { useEffect, useState } from "react";
import { type MembershipPlan } from "@/components/features/membership/MembershipPlans";
import ProfileDialog from "@/components/features/profile/ProfileDialog";
import SettingsDialog from "@/components/features/settings/SettingsDialog";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import NotificationToastStack from "@/components/layout/NotificationToastStack";
import { useRewards } from "@/hooks/useRewards";
import { useNotifications } from "@/hooks/useNotifications";
import { fetchAuthMeMembership } from "@/services/authApi";
import type { AppTab } from "@/components/layout/appShellTypes";

export type { AppTab } from "@/components/layout/appShellTypes";

interface AppShellProps {
  activeTab: AppTab | null;
  tabHrefMap: Record<AppTab, string>;
  username: string;
  email?: string;
  dateOfBirth?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  onProfileUpdate?: () => void;
  children: React.ReactNode;
}

/**
 * Post-login shell: sidebar + top bar + content area
 */
export default function AppShell({
  activeTab,
  tabHrefMap,
  username,
  email,
  dateOfBirth,
  country,
  avatarUrl,
  onLogout,
  onProfileUpdate,
  children,
}: AppShellProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membershipPlan, setMembershipPlan] = useState<MembershipPlan>("free");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { loading: rewardsLoading, coins, diamonds, flowers } = useRewards();
  const notifications = useNotifications(activeTab);

  const resolvedAvatarSrc = !avatarFailed && avatarUrl ? avatarUrl : "/dashboard/default.png";

  const closeOverlays = () => {
    setProfileOpen(false);
    setSettingsOpen(false);
    notifications.setOpen(false);
  };

  useEffect(() => {
    const syncMembershipPlan = () => {
      fetchAuthMeMembership()
        .then((m) => {
          const p = m.membership_plan;
          if (p === "free" || p === "plus" || p === "premium") {
            setMembershipPlan(p);
          }
        })
        .catch(() => {});
    };

    syncMembershipPlan();
    window.addEventListener("membership-plan-change", syncMembershipPlan);
    return () => window.removeEventListener("membership-plan-change", syncMembershipPlan);
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-8 text-slate-800">
      <AppHeader
        activeTab={activeTab}
        tabHrefMap={tabHrefMap}
        membershipPlan={membershipPlan}
        rewardsLoading={rewardsLoading}
        coins={coins}
        diamonds={diamonds}
        flowers={flowers}
        resolvedAvatarSrc={resolvedAvatarSrc}
        onAvatarError={() => setAvatarFailed(true)}
        onOpenProfile={() => {
          setSettingsOpen(false);
          notifications.setOpen(false);
          setProfileOpen(true);
        }}
        onOpenSettings={() => {
          setProfileOpen(false);
          notifications.setOpen(false);
          setSettingsOpen(true);
        }}
        onCloseOverlays={closeOverlays}
        onBeforeToggleNotifications={() => {
          setProfileOpen(false);
          setSettingsOpen(false);
        }}
        notifications={notifications}
      />

      <div className="flex">
        <AppSidebar activeTab={activeTab} tabHrefMap={tabHrefMap} />

        <div className="min-w-0 flex-1">
          <main className="px-4 pt-5 sm:px-6">{children}</main>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <NotificationToastStack
        notifications={notifications.toasts}
        bellRef={notifications.bellRef}
        onDismiss={notifications.dismissToast}
        onOpen={(id) => {
          notifications.markAsRead(id);
          notifications.dismissToast(id);
          setProfileOpen(false);
          setSettingsOpen(false);
          notifications.setOpen(true);
          notifications.bellRef.current?.focus();
        }}
      />

      <ProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        username={username}
        email={email}
        dateOfBirth={dateOfBirth}
        country={country}
        avatarUrl={avatarUrl}
        onLogout={onLogout}
        onProfileUpdate={onProfileUpdate}
      />
    </div>
  );
}
