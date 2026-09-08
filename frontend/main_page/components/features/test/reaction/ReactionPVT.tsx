"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

type Phase = "intro" | "practice" | "formal";
type ScreenState = "idle" | "waiting" | "ready" | "tooSoon" | "recorded";
type AgeBandId = "children" | "teens" | "youngAdults" | "middleAged" | "seniors";

interface AgeNormRange {
  min: number;
  max: number;
}

const FORMAL_TRIAL_COUNT = 5;
const TOO_SOON_FLASH_MS = 900;
const INTER_TRIAL_DELAY_MS = 800;
const WAIT_MIN_MS = 2000;
const WAIT_MAX_MS = 15000;
const MAX_PENALTY = 25;

const AGE_NORMS: Record<AgeBandId, AgeNormRange> = {
  children: { min: 325, max: 544 },
  teens: { min: 270, max: 450 },
  youngAdults: { min: 200, max: 300 },
  middleAged: { min: 300, max: 450 },
  seniors: { min: 450, max: 800 },
};

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const [yearStr, monthStr, dayStr] = dateOfBirth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;

  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  const dayDiff = now.getDate() - day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age >= 0 ? age : null;
}

function resolveAgeBand(age: number | null): AgeBandId | null {
  if (age == null) return null;
  if (age >= 6 && age <= 11) return "children";
  if (age >= 12 && age <= 18) return "teens";
  if (age >= 19 && age <= 35) return "youngAdults";
  if (age >= 36 && age <= 64) return "middleAged";
  if (age >= 65) return "seniors";
  return null;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeStabilityScore(values: number[]) {
  if (values.length <= 1) return 100;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return Math.round(100 * clamp((180 - std) / 180, 0, 1));
}

function mapReactionToScore(rtMs: number, ageBand: AgeBandId | null) {
  if (ageBand == null) {
    return Math.round(100 * clamp((800 - rtMs) / (800 - 200), 0, 1));
  }

  const norm = AGE_NORMS[ageBand];
  const normalized = clamp((norm.max - rtMs) / (norm.max - norm.min), 0, 1);
  return Math.round(20 + normalized * 80);
}

function resolveLapseThreshold(ageBand: AgeBandId | null) {
  if (ageBand == null) return 800;
  return AGE_NORMS[ageBand].max;
}

export default function ReactionPVT({
  onComplete,
  dateOfBirth,
}: {
  onComplete: (score: number) => void;
  dateOfBirth?: string | null;
}) {
  const t = useTranslations("test.reaction");
  const [phase, setPhase] = useState<Phase>("intro");
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [formalIndex, setFormalIndex] = useState(0);
  const [trialResults, setTrialResults] = useState<number[]>([]);
  const [practiceResult, setPracticeResult] = useState<number | null>(null);
  const [formalLapseCount, setFormalLapseCount] = useState(0);
  const [formalFalseStartCount, setFormalFalseStartCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  const ageBand = useMemo(() => resolveAgeBand(parseAge(dateOfBirth)), [dateOfBirth]);
  const lapseThreshold = useMemo(() => resolveLapseThreshold(ageBand), [ageBand]);

  useReportTestChrome(
    phase === "intro"
      ? { screen: "intro" }
      : {
          screen: "active",
          questionCurrent: phase === "formal" ? formalIndex + 1 : 1,
          questionTotal: phase === "formal" ? FORMAL_TRIAL_COUNT : 1,
        }
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearPendingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleRound = () => {
    clearPendingTimer();
    lockRef.current = false;
    startTimeRef.current = null;
    setScreenState("waiting");

    const delay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
    timerRef.current = setTimeout(() => {
      setScreenState("ready");
      startTimeRef.current = performance.now();
    }, delay);
  };

  const finishFormal = (results: number[]) => {
    const medianRt = Math.round(median(results));
    const bestRt = Math.round(Math.min(...results));
    const speedScore = mapReactionToScore(medianRt, ageBand);
    const bestScore = mapReactionToScore(bestRt, ageBand);
    const stabilityScore = computeStabilityScore(results);
    const rawScore = Math.round(speedScore * 0.7 + bestScore * 0.15 + stabilityScore * 0.15);
    const lapseCount = results.filter((value) => value > lapseThreshold).length;
    const penalty = clamp(lapseCount * 4 + formalFalseStartCount * 3, 0, MAX_PENALTY);
    const finalScore = clamp(rawScore - penalty, 0, 100);
    timerRef.current = setTimeout(() => {
      onComplete(finalScore);
    }, INTER_TRIAL_DELAY_MS);
  };

  const startPractice = () => {
    setPracticeResult(null);
    setTrialResults([]);
    setFormalIndex(0);
    setFormalLapseCount(0);
    setFormalFalseStartCount(0);
    setPhase("practice");
    scheduleRound();
  };

  const startFormal = () => {
    setTrialResults([]);
    setFormalIndex(0);
    setFormalLapseCount(0);
    setFormalFalseStartCount(0);
    setPhase("formal");
    scheduleRound();
  };

  const flashTooSoon = () => {
    clearPendingTimer();
    lockRef.current = true;
    startTimeRef.current = null;
    setScreenState("tooSoon");
    if (phase === "formal") {
      setFormalFalseStartCount((value) => value + 1);
    }
    timerRef.current = setTimeout(() => {
      lockRef.current = false;
      if (phase === "practice" || phase === "formal") scheduleRound();
    }, TOO_SOON_FLASH_MS);
  };

  const recordReaction = (rtMs: number) => {
    clearPendingTimer();
    lockRef.current = true;
    setScreenState("recorded");

    if (phase === "practice") {
      setPracticeResult(rtMs);
      timerRef.current = setTimeout(() => {
        lockRef.current = false;
        scheduleRound();
      }, INTER_TRIAL_DELAY_MS);
      return;
    }

    const nextResults = [...trialResults, rtMs];
    setTrialResults(nextResults);
    if (rtMs > lapseThreshold) {
      setFormalLapseCount((value) => value + 1);
    }

    if (formalIndex + 1 >= FORMAL_TRIAL_COUNT) {
      finishFormal(nextResults);
      return;
    }

    timerRef.current = setTimeout(() => {
      lockRef.current = false;
      setFormalIndex((value) => value + 1);
      scheduleRound();
    }, INTER_TRIAL_DELAY_MS);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (phase !== "practice" && phase !== "formal") return;

      event.preventDefault();
      if (lockRef.current) return;

      if (screenState === "waiting") {
        flashTooSoon();
        return;
      }

      if (screenState !== "ready" || startTimeRef.current == null) return;

      const rtMs = Math.round(Math.max(0, performance.now() - startTimeRef.current));
      recordReaction(rtMs);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, screenState, trialResults, formalIndex, formalFalseStartCount, ageBand]);

  const screenLabel =
    screenState === "waiting"
      ? t("pvtWaiting")
      : screenState === "ready"
        ? t("pvtPressNow")
        : screenState === "tooSoon"
          ? t("tooSoon")
          : screenState === "recorded"
            ? t("recorded")
            : t("pvtReady");

  if (phase === "intro") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("pvtTitle")}</h4>
        <p className="mb-3 text-sm text-gray-600">{t("pvtDesc")}</p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>{t("pvtRulePractice")}</li>
          <li>{t("pvtRuleFormal")}</li>
          <li>{t("pvtRuleNoEarly")}</li>
          <li>{t("pvtRuleLapse")}</li>
          <li>{t("pvtRuleReference")}</li>
        </ul>
        <button
          type="button"
          onClick={startPractice}
          className="rounded-lg bg-[#5E81AC] px-4 py-2 text-white"
        >
          {t("startPractice")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-md">
      <h4 className="mb-2 font-semibold text-gray-800">
        {phase === "practice" ? t("pvtPracticeTitle") : t("pvtTitle")}
      </h4>
      <span className="mb-3 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {phase === "practice" ? t("practiceBadge") : t("formalBadge")}
      </span>

      {phase === "practice" && <p className="mb-3 text-sm text-gray-600">{t("pvtPracticeDesc")}</p>}
      {phase === "formal" && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-500">
          <p>{t("formalProgress", { current: formalIndex + 1, total: FORMAL_TRIAL_COUNT })}</p>
          <p>{t("pvtStats", { lapse: formalLapseCount, falseStart: formalFalseStartCount })}</p>
        </div>
      )}

      <div className="mb-2 rounded-lg bg-black p-4">
        <div className="flex h-40 w-full items-center justify-center rounded border border-gray-700">
          <span className="text-6xl leading-none text-white">
            {screenState === "ready" ? "●" : " "}
          </span>
        </div>
      </div>
      <div
        className={`flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold ${
          screenState === "tooSoon"
            ? "bg-red-500 text-white"
            : screenState === "recorded"
              ? "bg-sky-500 text-white"
              : "bg-gray-100 text-gray-700"
        }`}
      >
        <span>{screenLabel}</span>
      </div>

      {phase === "practice" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            {practiceResult == null ? (
              <p className="font-semibold text-gray-600">{t("pvtPracticeHint")}</p>
            ) : (
              <p className="font-semibold text-emerald-600">
                {t("pvtPracticeResult", { value: practiceResult })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={startFormal}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
          >
            {t("startFormal")}
          </button>
        </div>
      )}
    </div>
  );
}
