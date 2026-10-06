"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import HomesteadBlock from "./HomesteadBlock";
import CheckInCalendar from "./CheckInCalendar";
import TaskList from "./TaskList";
import StreakRewardDialog, { type StreakRewardState } from "./StreakRewardDialog";
import { useRewards } from "@/hooks/useRewards";
import { useCognitiveScores } from "@/hooks/useCognitiveScores";
import StatCard from "@/components/features/dashboard/StatCard";
import BrainpowerPanel from "@/components/features/dashboard/BrainpowerPanel";
import { dashboardCardClass } from "@/components/features/dashboard/dashboardCardStyles";
import type { HomeSystemSlot } from "@/types/homeSystem";
import {
  formatLocalDateKey,
  formatWeekDateRange,
  getCurrentWeekProgress,
  getWeekStart,
  getWeekdayLabels,
  type WeeklyProgressDay,
} from "@/lib/weekProgress";

interface HomeTabProps {
  username?: string;
  avatarUrl?: string | null;
}

/**
 * Dashboard home content: KPI + stage + check-in/tasks + brainpower panel
 */
export default function HomeTab({ username = "", avatarUrl = null }: HomeTabProps) {
  const tHome = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const weekdayLabels = useMemo(() => getWeekdayLabels(tHome), [tHome]);
  const {
    loading: rewardsLoading,
    coins,
    diamonds,
    flowers,
    checkIn,
    hasCheckedInToday,
    doCheckIn,
    dailyProgress,
    monthlyProgress,
    monthlyTarget,
    taskClaimedToday,
    monthlyClaimed,
    playedGameCount,
    claimTaskReward,
  } = useRewards();
  const { scores: radarScores } = useCognitiveScores();
  const [activeHomesteadTab, setActiveHomesteadTab] = useState<HomeSystemSlot | null>(null);
  const [isHomesteadMenuOpen, setIsHomesteadMenuOpen] = useState(false);
  const [showStreakRewardDialog, setShowStreakRewardDialog] = useState(false);
  const [streakReward, setStreakReward] = useState<StreakRewardState>({
    streak: 0,
    coins: 0,
    membershipBonusPlan: null,
    membershipBonusCoins: 0,
    membershipBonusDiamonds: 0,
    diamonds: 0,
    flowers: 0,
  });
  const [streakDateRange, setStreakDateRange] = useState("");
  const [weeklyProgressDays, setWeeklyProgressDays] = useState<WeeklyProgressDay[]>([]);

  const totalPoints = coins + diamonds * 10 + flowers * 3;

  const handleCheckIn = async () => {
    const result = await doCheckIn();
    if (!result) return;

    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const todayKey = formatLocalDateKey(today);
    const nextSignedDates = result.checkInDatesAfter.length
      ? result.checkInDatesAfter
      : Array.from(new Set([...checkIn.dates, todayKey]));

    setStreakReward({
      streak: result.streakAfter,
      coins: result.coins,
      membershipBonusPlan: result.membershipBonusPlan,
      membershipBonusCoins: result.membershipBonusCoins,
      membershipBonusDiamonds: result.membershipBonusDiamonds,
      diamonds: result.diamonds,
      flowers: result.flowers,
    });
    setStreakDateRange(formatWeekDateRange(weekStart, weekEnd, tHome("dateRangeSeparator")));
    setWeeklyProgressDays(getCurrentWeekProgress(nextSignedDates, weekdayLabels, today));
    setShowStreakRewardDialog(true);
  };

  if (rewardsLoading) {
    return (
      <div className="flex justify-center py-14">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <p className="text-sm text-slate-500">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          iconSrc="/dashboard/Cup.svg"
          iconAlt={tHome("totalPoints")}
          iconBgColor="#D4EAF8"
          title={tHome("totalPoints")}
          value={totalPoints.toLocaleString()}
        />
        <StatCard
          iconSrc="/dashboard/Fire.svg"
          iconAlt={tHome("dayStreak")}
          iconBgColor="#FFF5F5"
          title={tHome("dayStreak")}
          value={`${checkIn.streak} ${tHome("daysUnit")}`}
        />
        <StatCard
          iconSrc="/dashboard/Star.svg"
          iconAlt={tHome("gamesPlayed")}
          iconBgColor="#D4F3E6"
          title={tHome("gamesPlayed")}
          value={playedGameCount.toLocaleString()}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div
            className={`${dashboardCardClass} relative min-h-[clamp(20rem,42svh,31.25rem)] overflow-visible p-4 md:min-h-[clamp(22rem,46svh,31.25rem)]`}
          >
            <HomesteadBlock
              userAvatarUrl={avatarUrl}
              coins={coins}
              diamonds={diamonds}
              activeCustomizeTab={activeHomesteadTab}
              menuOpen={isHomesteadMenuOpen}
              onMenuOpenChange={(isOpen) => {
                setIsHomesteadMenuOpen(isOpen);
              }}
              onCustomizeTabChange={setActiveHomesteadTab}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <CheckInCalendar
              checkIn={checkIn}
              hasCheckedInToday={hasCheckedInToday}
              onCheckIn={() => {
                void handleCheckIn();
              }}
            />
            <TaskList
              dailyProgress={dailyProgress}
              monthlyProgress={monthlyProgress}
              monthlyTarget={monthlyTarget}
              taskClaimedToday={taskClaimedToday}
              monthlyClaimed={monthlyClaimed}
              onClaimTask={claimTaskReward}
            />
          </div>
        </div>

        <div className="xl:col-span-4">
          <BrainpowerPanel scores={radarScores} />
        </div>
      </section>

      <StreakRewardDialog
        open={showStreakRewardDialog}
        reward={streakReward}
        dateRange={streakDateRange}
        weeklyProgressDays={weeklyProgressDays}
        onClose={() => setShowStreakRewardDialog(false)}
      />
    </div>
  );
}
