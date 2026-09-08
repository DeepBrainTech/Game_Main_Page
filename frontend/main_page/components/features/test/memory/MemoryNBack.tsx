"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

type NBackMode = "grid" | "letter";

interface MemoryNBackProps {
  onComplete: (score: number) => void;
  dateOfBirth?: string | null;
}

interface FormalStats {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

type AgeBandId = "children" | "teens" | "youngAdults" | "middleAged" | "seniors";

const PRACTICE_INTERVAL_MS = 2000;
const FORMAL_INTERVAL_MS = 2000;
const MATCH_RATE = 0.35;
const FORMAL_BASE_SEED = 20260316;
const FIXED_LEVEL = 2;
const FORMAL_LEVELS: number[] = Array.from({ length: 20 }, () => FIXED_LEVEL);

const AGE_NORMS_NBACK: Record<
  AgeBandId,
  { accuracyPct: [number, number]; dPrime: [number, number]; rtMs: [number, number] }
> = {
  // 来自你提供的研究参数；Seniors 按产品要求调整为 60+。
  children: { accuracyPct: [65, 75], dPrime: [1.0, 1.8], rtMs: [800, 1100] }, // 7-12
  teens: { accuracyPct: [80, 90], dPrime: [2.5, 3.2], rtMs: [650, 850] }, // 13-18
  youngAdults: { accuracyPct: [90, 95], dPrime: [3.5, 4.5], rtMs: [550, 750] }, // 19-35
  middleAged: { accuracyPct: [80, 88], dPrime: [2.5, 3.5], rtMs: [700, 900] }, // 36-59
  seniors: { accuracyPct: [60, 75], dPrime: [1.2, 2.0], rtMs: [900, 1200] }, // 60+
};


function clampScore(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function percentileToZ(p: number) {
  const pSafe = Math.min(1 - 1e-10, Math.max(1e-10, p));
  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;
  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;
  const c1 = -0.00778489400243029;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;
  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  if (pSafe < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(pSafe));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  if (pSafe > 1 - 0.02425) {
    const q = Math.sqrt(-2 * Math.log(1 - pSafe));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  const q = pSafe - 0.5;
  const r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

function computeDPrime(tp: number, fn: number, fp: number, tn: number) {
  const targetN = tp + fn;
  const nonTargetN = fp + tn;
  const hitRate = targetN > 0 ? (tp + 0.5) / (targetN + 1) : 0.5;
  const faRate = nonTargetN > 0 ? (fp + 0.5) / (nonTargetN + 1) : 0.5;
  return percentileToZ(hitRate) - percentileToZ(faRate);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function normalizeLinear(value: number, min: number, max: number) {
  if (max <= min) return 50;
  return clampScore(((value - min) / (max - min)) * 100, 0, 100);
}

function normalizeReverse(value: number, min: number, max: number) {
  return 100 - normalizeLinear(value, min, max);
}

function computeAbilityScore(dPrime: number, medianRtMs: number | null) {
  const dPrimeScore = normalizeLinear(dPrime, -1.0, 4.5);
  const rtScore = medianRtMs == null ? 50 : clampScore(((1400 - medianRtMs) / 950) * 100, 0, 100);
  return Math.round(dPrimeScore * 0.7 + rtScore * 0.3);
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
  if (age >= 7 && age <= 12) return "children";
  if (age >= 13 && age <= 18) return "teens";
  if (age >= 19 && age <= 35) return "youngAdults";
  if (age >= 60) return "seniors";
  if (age >= 36 && age <= 59) return "middleAged";
  return null;
}

function computeAgePercentile(
  accuracyPct: number,
  dPrime: number,
  medianRtMs: number | null,
  ageBand: AgeBandId | null
) {
  if (ageBand == null) return null;
  const norm = AGE_NORMS_NBACK[ageBand];
  const accuracyScore = normalizeLinear(accuracyPct, norm.accuracyPct[0], norm.accuracyPct[1]);
  const dPrimeScore = normalizeLinear(dPrime, norm.dPrime[0], norm.dPrime[1]);
  const rtScore = medianRtMs == null ? 50 : normalizeReverse(medianRtMs, norm.rtMs[0], norm.rtMs[1]);
  return Math.round(accuracyScore * 0.2 + dPrimeScore * 0.5 + rtScore * 0.3);
}

function getPool(mode: NBackMode) {
  return mode === "letter"
    ? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]
    : Array.from({ length: 9 }, (_, i) => String(i));
}

// 使用可复现伪随机，保证固定 seed 下题目序列可复现。
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createStimulus(
  mode: NBackMode,
  level: number,
  history: string[],
  wantMatch: boolean,
  rand: () => number
) {
  const pool = getPool(mode);
  const canMatch = history.length >= level;
  const shouldMatch = canMatch && wantMatch;
  const target = canMatch ? history[history.length - level] : null;

  if (shouldMatch && target) {
    return { current: target, isMatch: true };
  }

  let candidate = pool[Math.floor(rand() * pool.length)];
  while (target && candidate === target && pool.length > 1) {
    candidate = pool[Math.floor(rand() * pool.length)];
  }

  return { current: candidate, isMatch: false };
}

export default function MemoryNBack({ onComplete, dateOfBirth }: MemoryNBackProps) {
  const t = useTranslations("test.memory");

  const [phase, setPhase] = useState<"intro" | "practice" | "formal">("intro");

  const [practiceMode, setPracticeMode] = useState<NBackMode>("grid");
  const [practiceRunning, setPracticeRunning] = useState(false);
  const [practiceStream, setPracticeStream] = useState<string[]>([]);
  const [practiceCurrent, setPracticeCurrent] = useState<string | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<"correct" | "wrong" | "wait" | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [formalMode, setFormalMode] = useState<NBackMode>("grid");
  const [formalFixedMode, setFormalFixedMode] = useState<NBackMode>("grid");
  const [formalHistory, setFormalHistory] = useState<string[]>([]);
  const [formalCurrent, setFormalCurrent] = useState<string | null>(null);
  const [isFormalRunning, setIsFormalRunning] = useState(false);
  const [hasMarkedSame, setHasMarkedSame] = useState(false);
  const hasMarkedSameRef = useRef(false);

  const [stats, setStats] = useState<FormalStats>({ tp: 0, tn: 0, fp: 0, fn: 0 });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formalRandRef = useRef<() => number>(() => Math.random());
  const trialStartTsRef = useRef<number>(0);
  const clickTsRef = useRef<number | null>(null);
  const correctHitRtMsRef = useRef<number[]>([]);
  const tpRef = useRef(0);
  const tnRef = useRef(0);
  const fpRef = useRef(0);
  const fnRef = useRef(0);

  // 正式阶段计分累积器。

  const totalQuestions = FORMAL_LEVELS.length;

  useReportTestChrome(
    phase === "intro"
      ? { screen: "intro" }
      : {
          screen: "active",
          questionCurrent: phase === "formal" ? Math.min(currentIndex + 1, totalQuestions) : 1,
          questionTotal: phase === "formal" ? totalQuestions : 1,
        }
  );

  const resetPractice = () => {
    setPracticeStream([]);
    setPracticeCurrent(null);
    setPracticeRunning(true);
    setPracticeFeedback(null);
  };

  const startFormal = () => {
    setCurrentIndex(0);
    setFormalFixedMode(practiceMode);
    setFormalMode(practiceMode);
    setFormalHistory([]);
    setFormalCurrent(null);
    setHasMarkedSame(false);
    hasMarkedSameRef.current = false;

    setStats({ tp: 0, tn: 0, fp: 0, fn: 0 });

    // 固定 seed；不同模式给不同偏移，避免两模式题面完全一致。
    formalRandRef.current = mulberry32(
      FORMAL_BASE_SEED + (practiceMode === "grid" ? 0 : 10007)
    );

    correctHitRtMsRef.current = [];
    clickTsRef.current = null;
    trialStartTsRef.current = 0;
    tpRef.current = 0;
    tnRef.current = 0;
    fpRef.current = 0;
    fnRef.current = 0;

    setIsFormalRunning(false);
    setPhase("formal");
  };

  const beginFormalRun = () => {
    setIsFormalRunning(true);
  };

  // 练习阶段：按固定节拍自动播放 stimulus，支持即时自测反馈。
  useEffect(() => {
    if (phase !== "practice" || !practiceRunning) {
      if (practiceTimerRef.current) {
        clearTimeout(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
      return;
    }

    const pool = getPool(practiceMode);
    practiceTimerRef.current = setTimeout(() => {
      setPracticeStream((prev) => {
        const idx = prev.length;
        const canMatch = idx >= FIXED_LEVEL;
        const shouldMatch = canMatch && Math.random() < MATCH_RATE;

        let next = pool[Math.floor(Math.random() * pool.length)];
        if (shouldMatch) {
          next = prev[idx - FIXED_LEVEL];
        } else if (canMatch) {
          const target = prev[idx - FIXED_LEVEL];
          while (next === target && pool.length > 1) {
            next = pool[Math.floor(Math.random() * pool.length)];
          }
        }

        setPracticeCurrent(next);
        setPracticeFeedback(null);
        return [...prev, next];
      });
    }, PRACTICE_INTERVAL_MS);

    return () => {
      if (practiceTimerRef.current) {
        clearTimeout(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
    };
  }, [phase, practiceRunning, practiceMode, practiceStream.length]);

  // 正式阶段：固定题单（20 题，全部 2-back）。
  useEffect(() => {
    if (phase !== "formal" || !isFormalRunning) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (currentIndex >= totalQuestions) {
      return;
    }

    const mode: NBackMode = formalFixedMode;
    const level = FIXED_LEVEL;
    const wantMatch = formalRandRef.current() < MATCH_RATE;
    const generated = createStimulus(mode, level, formalHistory, wantMatch, formalRandRef.current);

    setFormalMode(mode);
    setFormalCurrent(generated.current);
    setHasMarkedSame(false);
    hasMarkedSameRef.current = false;
    clickTsRef.current = null;
    trialStartTsRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      const clickedSame = hasMarkedSameRef.current;
      const isCorrect =
        (clickedSame && generated.isMatch) || (!clickedSame && !generated.isMatch);

      if (clickedSame && generated.isMatch) tpRef.current += 1;
      else if (!clickedSame && !generated.isMatch) tnRef.current += 1;
      else if (clickedSame && !generated.isMatch) fpRef.current += 1;
      else fnRef.current += 1;
      setStats({
        tp: tpRef.current,
        tn: tnRef.current,
        fp: fpRef.current,
        fn: fnRef.current,
      });

      if (isCorrect && generated.isMatch && clickTsRef.current != null) {
        const rt = clickTsRef.current - trialStartTsRef.current;
        if (rt >= 50 && rt <= FORMAL_INTERVAL_MS + 200) {
          correctHitRtMsRef.current.push(rt);
        }
      }

      const isLast = currentIndex + 1 >= totalQuestions;
      if (isLast) {
        const dPrime = computeDPrime(tpRef.current, fnRef.current, fpRef.current, tnRef.current);
        const medianRtValue = median(correctHitRtMsRef.current);
        const total = tpRef.current + tnRef.current + fpRef.current + fnRef.current;
        const accuracyPct = total > 0 ? ((tpRef.current + tnRef.current) / total) * 100 : 0;
        const abilityScore = computeAbilityScore(dPrime, medianRtValue);
        const ageBand = resolveAgeBand(parseAge(dateOfBirth));
        const agePercentile = computeAgePercentile(accuracyPct, dPrime, medianRtValue, ageBand);
        const computedDisplay =
          agePercentile == null
            ? abilityScore
            : Math.round(abilityScore * 0.7 + agePercentile * 0.3);

        onComplete(clampScore(computedDisplay, 0, 100));
        setIsFormalRunning(false);
      } else {
        setCurrentIndex((idx) => idx + 1);
      }

      setFormalHistory((prev) => [...prev, generated.current]);
    }, FORMAL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    phase,
    isFormalRunning,
    currentIndex,
    formalHistory,
    formalFixedMode,
    dateOfBirth,
    onComplete,
    totalQuestions,
  ]);

  const handlePracticeSame = () => {
    if (!practiceRunning || !practiceCurrent) return;

    const idx = practiceStream.length - 1;
    if (idx < FIXED_LEVEL) {
      setPracticeFeedback("wait");
      return;
    }

    const actual = practiceStream[idx] === practiceStream[idx - FIXED_LEVEL];
    setPracticeFeedback(actual ? "correct" : "wrong");
  };

  const handleFormalSame = () => {
    if (!isFormalRunning) return;
    if (hasMarkedSameRef.current) return;
    setHasMarkedSame(true);
    hasMarkedSameRef.current = true;
    clickTsRef.current = Date.now();
  };

  // 空格键作为 Match 快捷键；默认不按键即表示 Different。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (phase === "practice" && practiceRunning) {
        event.preventDefault();
        handlePracticeSame();
      } else if (phase === "formal" && isFormalRunning) {
        event.preventDefault();
        handleFormalSame();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, practiceRunning, isFormalRunning, practiceStream, practiceCurrent]);

  const renderSequence = (
    mode: NBackMode,
    level: number,
    current: string | null,
    showHint = true
  ) => {
    const value = current ?? "";
    const hasValue = value !== "";

    if (mode === "grid") {
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium ${
                  hasValue && String(i) === value
                    ? "border-[#5E81AC] bg-[#5E81AC] text-white animate-pulse"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              />
            ))}
          </div>
          {showHint && <p className="text-xs text-gray-500">{t("nBackHintGrid", { level })}</p>}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center">
          <div className="flex h-[136px] w-[136px] items-center justify-center rounded-xl border-2 border-[#5E81AC] bg-white text-5xl font-bold text-[#5E81AC] animate-pulse">
            {value || "\u00A0"}
          </div>
        </div>
        {showHint && <p className="text-xs text-gray-500">{t("nBackHintLetter", { level })}</p>}
      </div>
    );
  };

  if (phase === "intro") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("nBackTitle")}</h4>
        <p className="mb-3 text-sm text-gray-600">{t("nBackIntro1")}</p>
        <button
          type="button"
          onClick={() => {
            setPhase("practice");
            resetPractice();
          }}
          className="rounded-lg bg-[#5E81AC] px-4 py-2 text-sm font-medium text-white hover:bg-[#4E719C]"
        >
          {t("startPractice")}
        </button>
      </div>
    );
  }

  if (phase === "practice") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("nBackPracticeTitle")}</h4>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#5E81AC]">
          {t("nBackPracticeBadge")}
        </p>
        <p className="mb-4 text-sm text-gray-600">{t("nBackPracticeDesc")}</p>
        <p className="mb-4 text-xs text-gray-500">{t("nBackFixedLevelHint", { level: FIXED_LEVEL })}</p>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPracticeMode("grid");
              resetPractice();
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              practiceMode === "grid"
                ? "bg-[#5E81AC] text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("practiceModeGrid")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPracticeMode("letter");
              resetPractice();
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              practiceMode === "letter"
                ? "bg-[#5E81AC] text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("practiceModeLetter")}
          </button>
        </div>

        <div className="mb-4">{renderSequence(practiceMode, FIXED_LEVEL, practiceCurrent)}</div>

        <p className="mb-3 text-sm font-medium text-gray-700">
          {t("nBackQuestion", { level: FIXED_LEVEL })}
        </p>
        <p className="mb-2 text-xs text-gray-500">{t("practiceStreamHint")}</p>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resetPractice}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("resetPractice")}
          </button>
          <button
            type="button"
            onClick={handlePracticeSame}
            className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            {t("answerSame")}
          </button>
          <button
            type="button"
            onClick={startFormal}
            className="ml-auto rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {t("startFormal")}
          </button>
        </div>

        {practiceRunning && <p className="text-xs text-gray-500">{t("answerSameWhenMatch")}</p>}
        {practiceFeedback && (
          <p
            className={`mt-2 text-xs font-medium ${
              practiceFeedback === "correct"
                ? "text-emerald-600"
                : practiceFeedback === "wrong"
                  ? "text-red-600"
                  : "text-gray-500"
            }`}
          >
            {practiceFeedback === "correct"
              ? t("practiceFeedbackCorrect")
              : practiceFeedback === "wrong"
                ? t("practiceFeedbackWrong")
                : t("practiceFeedbackWait")}
          </p>
        )}
      </div>
    );
  }

  if (phase === "formal") {
    const progressPercent = isFormalRunning
      ? Math.round((Math.min(currentIndex + 1, totalQuestions) / totalQuestions) * 100)
      : 0;

    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 text-center font-semibold text-gray-800">{t("nBackTitle")}</h4>
        <p className="mb-3 text-center text-xs text-gray-500">
          {t("nBackFixedLevelHint", { level: FIXED_LEVEL })}
        </p>
        <div className="mb-4 flex justify-center">
          {renderSequence(formalMode, FIXED_LEVEL, formalCurrent, false)}
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleFormalSame}
              disabled={!isFormalRunning}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                hasMarkedSame
                  ? "bg-[#5E81AC] text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              } ${!isFormalRunning ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {t("answerSame")}
            </button>
            {!isFormalRunning && (
              <button
                type="button"
                onClick={beginFormalRun}
                className="rounded-lg bg-[#5E81AC] px-5 py-2 text-sm font-medium text-white hover:bg-[#4E719C]"
              >
                {t("startNow")}
              </button>
            )}
          </div>
          <div
            className="w-full max-w-xs"
            aria-label={t("formalProgress", { current: progressPercent, total: 100 })}
          >
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#5E81AC] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
