"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { DAILY_TASKS, MONTHLY_TASK, type TaskConfig } from "@/config/tasks";
import {
  dashboardCardClass,
  dashboardPairedCardPadding,
  dashboardSectionHeaderBlockClass,
  dashboardSectionStatusBadgeClass,
  dashboardSectionSubtitleClass,
  dashboardSectionSubtitleRowClass,
  dashboardSectionTitleClass,
} from "@/components/features/dashboard/dashboardCardStyles";

interface TaskListProps {
  dailyProgress: Record<string, number>;
  monthlyProgress: { count: number; month: string };
  monthlyTarget: number;
  taskClaimedToday: Set<string>;
  monthlyClaimed: boolean;
  onClaimTask: (taskId: string) => Promise<void>;
}

function TaskRow({
  task,
  current,
  target,
  done,
  claimed,
  onClaim,
}: {
  task: TaskConfig;
  current: number;
  target: number;
  done: boolean;
  claimed: boolean;
  onClaim: () => void;
}) {
  const tTasks = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await onClaim();
    } finally {
      setClaiming(false);
    }
  };

  const rewardValue = task.rewardCoins ?? task.rewardDiamonds ?? 0;
  const isCoinReward = (task.rewardCoins ?? 0) > 0;
  const rewardIcon = isCoinReward ? "/dashboard/coin.svg" : "/dashboard/dimond.svg";
  const rewardBg = done ? "bg-[#22C55E]" : "bg-[#E45C44]";
  const statusBorder = done ? "border-green-400" : "border-transparent";
  const statusBg = done ? "bg-emerald-100" : "bg-[#EDF4FC]";
  const textColor = done ? "text-green-500 line-through" : "text-sky-700";
  const displayCurrent = target > 0 ? Math.min(current, target) : current;

  return (
    <div
      className={`w-full rounded-[clamp(0.9rem,1.3vw,1.3rem)] border-2 px-[clamp(0.7rem,1.2vw,1rem)] py-[clamp(0.55rem,1vw,0.85rem)] ${statusBg} ${statusBorder}`}
    >
      <div className="flex flex-wrap items-center gap-[clamp(0.5rem,1vw,1rem)]">
        <div className="inline-flex h-[clamp(1rem,1.8vw,1.5rem)] w-[clamp(1rem,1.8vw,1.5rem)] items-center justify-center">
          <Image
            src={done ? "/dashboard/checkin_icon.svg" : "/dashboard/nocheckin_icon.svg"}
            alt={done ? "done" : "pending"}
            width={15}
            height={15}
            className="h-[clamp(0.72rem,1.1vw,0.95rem)] w-[clamp(0.72rem,1.1vw,0.95rem)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className={`font-app-body text-[clamp(0.78rem,1vw,1rem)] font-medium text-base leading-[1.25] whitespace-normal break-words ${textColor}`}>
            {tTasks(task.labelKey)}
          </div>
          <div className="mt-[clamp(0.1rem,0.4vw,0.3rem)] font-app-body text-[clamp(0.62rem,0.85vw,0.78rem)] font-medium text-sky-700/70">
            {displayCurrent}/{target}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-[clamp(0.25rem,0.8vw,0.5rem)]">
          <div className={`inline-flex items-center justify-center gap-1 rounded-full px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.22rem,0.6vw,0.4rem)] ${rewardBg}`}>
            <Image
              src={rewardIcon}
              alt="reward"
              width={14}
              height={14}
              className="h-[clamp(0.68rem,1vw,0.88rem)] w-[clamp(0.68rem,1vw,0.88rem)]"
            />
            <span className="text-center font-app-body text-[clamp(0.72rem,0.95vw,0.95rem)] font-medium leading-[1] text-white">
              {rewardValue}
            </span>
          </div>

          {done && !claimed ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              className="rounded-full bg-[#E45C44] px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.22rem,0.6vw,0.4rem)] font-app-body text-[clamp(0.62rem,0.85vw,0.78rem)] font-medium text-white disabled:opacity-50"
            >
              {claiming ? tCommon("loading") : tCommon("claim")}
            </button>
          ) : null}

        </div>
      </div>
    </div>
  );
}

function getMonthDateRange(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return `${month}.1-${month}.${lastDay}`;
}

export default function TaskList({
  dailyProgress,
  monthlyProgress,
  monthlyTarget,
  taskClaimedToday,
  monthlyClaimed,
  onClaimTask,
}: TaskListProps) {
  const tTasks = useTranslations("tasks");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyCount = monthlyProgress.month === thisMonth ? monthlyProgress.count : 0;
  const monthDateRange = getMonthDateRange();

  const dailyDoneCount = DAILY_TASKS.filter((task) => {
    const current = dailyProgress[task.id] ?? 0;
    const target = task.targetCount ?? 1;
    return target > 0 && current >= target;
  }).length;

  const monthlyDone = monthlyCount >= monthlyTarget ? 1 : 0;
  const totalCompleted = dailyDoneCount + monthlyDone;
  const totalGoals = DAILY_TASKS.length + 1;

  return (
    <div className={`${dashboardCardClass} flex w-full flex-col ${dashboardPairedCardPadding}`}>
      <div className={dashboardSectionHeaderBlockClass}>
        <h3 className={dashboardSectionTitleClass}>{tTasks("title")}</h3>
        <span className={dashboardSectionStatusBadgeClass}>
          {tTasks("completionProgress", { completed: totalCompleted, total: totalGoals })}
        </span>
      </div>

      <div className={dashboardSectionSubtitleRowClass}>
        <div className={dashboardSectionSubtitleClass}>
          {tTasks("dailyGoals")} ({dailyDoneCount}/{DAILY_TASKS.length})
        </div>
      </div>

      <div className="flex w-full flex-col gap-[clamp(0.8rem,1.6vw,1.5rem)]">
        <div className="flex w-full flex-col gap-[clamp(0.6rem,1.2vw,1.25rem)]">
          <div className="flex w-full flex-col gap-[clamp(0.4rem,0.9vw,0.75rem)]">
            {DAILY_TASKS.map((task) => {
              const current = dailyProgress[task.id] ?? 0;
              const target = task.targetCount ?? 1;
              const done = target > 0 ? current >= target : false;
              const claimed = taskClaimedToday.has(task.id);
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  current={current}
                  target={target}
                  done={done}
                  claimed={claimed}
                  onClaim={() => onClaimTask(task.id)}
                />
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col gap-[clamp(0.6rem,1.2vw,1.25rem)]">
          <div className={dashboardSectionSubtitleClass}>
            {tTasks("monthlyGoals")} ({monthlyDone}/1){" "}
            <span className="font-medium text-[clamp(0.62rem,0.85vw,0.8rem)] text-sky-700/70">{monthDateRange}</span>
          </div>
          <div className="flex w-full flex-col gap-[clamp(0.4rem,0.9vw,0.75rem)]">
            <TaskRow
              task={MONTHLY_TASK}
              current={monthlyCount}
              target={monthlyTarget}
              done={monthlyDone === 1}
              claimed={monthlyClaimed}
              onClaim={() => onClaimTask("monthly-1")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
