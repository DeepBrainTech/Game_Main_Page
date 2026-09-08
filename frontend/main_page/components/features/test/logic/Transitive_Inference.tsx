"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

type OptionKey = "leftGtRight" | "leftLtRight" | "equal" | "unknown";

interface TIQuestion {
  id: string;
  chain: string[];
  left: string;
  right: string;
}

type AgeBandId = "children" | "preteens" | "teens" | "youngAdults" | "middleAged" | "seniors";

interface AgeNormRange {
  accMin: number;
  accMax: number;
  rtMin: number;
  rtMax: number;
}

const PRACTICE_QUESTION: TIQuestion = {
  id: "practice-1",
  chain: ["A", "B", "C"],
  left: "A",
  right: "C",
};

const FORMAL_QUESTIONS: TIQuestion[] = [
  // 相邻对（4题）
  { id: "adj-1", chain: ["A", "B", "C", "D", "E"], left: "A", right: "B" },
  { id: "adj-2", chain: ["🍉", "🍎", "🍐", "🍊", "🍒"], left: "🍎", right: "🍐" },
  { id: "adj-3", chain: ["K", "L", "M", "N", "O"], left: "M", right: "N" },
  { id: "adj-4", chain: ["◆", "●", "▲", "■", "★"], left: "■", right: "★" },
  // Core TI（4题）
  { id: "core-1", chain: ["A", "B", "C", "D", "E"], left: "B", right: "D" },
  { id: "core-2", chain: ["🦅", "🕊️", "🐦", "🐤", "🐣"], left: "🦅", right: "🐦" },
  { id: "core-3", chain: ["P", "Q", "R", "S", "T"], left: "Q", right: "T" },
  { id: "core-4", chain: ["🔷", "🔶", "⬛", "⬜", "🟤"], left: "⬛", right: "🟤" },
  // 距离效应（4题：距离 1/2/3/4）
  { id: "dist-1", chain: ["A", "B", "C", "D", "E", "F"], left: "B", right: "C" },
  { id: "dist-2", chain: ["⚫", "🟣", "🔵", "🟢", "🟡", "🟠"], left: "🟣", right: "🟢" },
  { id: "dist-3", chain: ["L", "M", "N", "O", "P", "Q"], left: "M", right: "P" },
  { id: "dist-4", chain: ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪"], left: "🟧", right: "🟪" },
  // 边界题（3题）
  { id: "bound-1", chain: ["A", "B", "C", "D", "E"], left: "A", right: "E" },
  { id: "bound-2", chain: ["🍇", "🍒", "🍑", "🍊", "🍌"], left: "🍇", right: "🍊" },
  { id: "bound-3", chain: ["R", "S", "T", "U", "V"], left: "S", right: "V" },
  // 逆向题（3题）
  { id: "rev-1", chain: ["A", "B", "C", "D", "E"], left: "B", right: "A" },
  { id: "rev-2", chain: ["🐘", "🐄", "🐖", "🐑", "🐇"], left: "🐇", right: "🐖" },
  { id: "rev-3", chain: ["K", "L", "M", "N", "O"], left: "N", right: "L" },
];

const AGE_NORMS: Record<AgeBandId, AgeNormRange> = {
  children: { accMin: 55, accMax: 70, rtMin: 1200, rtMax: 1800 }, // 6-10
  preteens: { accMin: 65, accMax: 80, rtMin: 1000, rtMax: 1500 }, // 11-12
  teens: { accMin: 75, accMax: 90, rtMin: 800, rtMax: 1200 }, // 13-17
  youngAdults: { accMin: 90, accMax: 98, rtMin: 600, rtMax: 900 }, // 18-30
  middleAged: { accMin: 85, accMax: 95, rtMin: 700, rtMax: 1000 }, // 31-59
  seniors: { accMin: 65, accMax: 85, rtMin: 900, rtMax: 1400 }, // 60+
};

function getOptionOrder(seed: string): OptionKey[] {
  const arr: OptionKey[] = ["leftGtRight", "leftLtRight", "equal"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = arr.length - 1; i > 0; i -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  // “无法确定”固定放在第 4 个位置，避免选项位置漂移。
  return [...arr, "unknown"];
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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
  if (age >= 6 && age <= 10) return "children";
  if (age >= 11 && age <= 12) return "preteens";
  if (age >= 13 && age <= 17) return "teens";
  if (age >= 18 && age <= 30) return "youngAdults";
  if (age >= 60) return "seniors";
  if (age >= 31 && age <= 59) return "middleAged";
  return null;
}

function computeAgeNormScore(
  accuracyPct: number,
  medianRtMs: number | null,
  ageBand: AgeBandId | null,
  totalAnswered: number
) {
  if (ageBand == null) {
    // 无年龄信息时回退到准确率分，避免无结果。
    return Math.round(clamp(accuracyPct, 0, 100));
  }
  const norm = AGE_NORMS[ageBand];
  const accNorm = clamp((accuracyPct - norm.accMin) / (norm.accMax - norm.accMin), 0, 1);
  const rtNorm =
    medianRtMs == null ? 0.5 : clamp((norm.rtMax - medianRtMs) / (norm.rtMax - norm.rtMin), 0, 1);
  let score = Math.round(100 * (accNorm * 0.75 + rtNorm * 0.25));

  // 题量不足时降低置信度影响；准确率极低时限制上限。
  if (totalAnswered < 12) score = Math.round(score * 0.9);
  if (accuracyPct < 50) score = Math.min(score, 40);
  return clamp(score, 0, 100);
}

function getCorrectOption(question: TIQuestion): OptionKey {
  const rank = new Map<string, number>();
  question.chain.forEach((item, idx) => rank.set(item, idx));
  const leftRank = rank.get(question.left);
  const rightRank = rank.get(question.right);
  if (leftRank === undefined || rightRank === undefined) return "unknown";
  if (leftRank < rightRank) return "leftGtRight";
  if (leftRank > rightRank) return "leftLtRight";
  return "equal";
}

function formatChain(chain: string[]) {
  return chain.join(" > ");
}

/** 传递推理：已知 A > B、B > C，判断哪一项一定正确 */
export default function TransitiveInference({
  onComplete,
  dateOfBirth,
}: {
  onComplete: (score: number) => void;
  dateOfBirth?: string | null;
}) {
  const t = useTranslations("test.logic");
  const [phase, setPhase] = useState<"intro" | "practice" | "formal">("intro");
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [practiceCorrect, setPracticeCorrect] = useState<boolean | null>(null);
  const [formalIndex, setFormalIndex] = useState(0);
  const [formalCorrectCount, setFormalCorrectCount] = useState(0);
  const formalCorrectRtMsRef = useRef<number[]>([]);
  const questionStartTsRef = useRef<number>(0);

  const startPractice = () => {
    setSelected(null);
    setPracticeCorrect(null);
    setPhase("practice");
  };

  const startFormal = () => {
    setSelected(null);
    setFormalIndex(0);
    setFormalCorrectCount(0);
    formalCorrectRtMsRef.current = [];
    setPhase("formal");
  };

  const currentQuestion = phase === "formal" ? FORMAL_QUESTIONS[formalIndex] : PRACTICE_QUESTION;
  const options = getOptionOrder(currentQuestion.id);
  const correct = getCorrectOption(currentQuestion);
  const ageBand = useMemo(() => resolveAgeBand(parseAge(dateOfBirth)), [dateOfBirth]);

  useReportTestChrome(
    phase === "intro"
      ? { screen: "intro" }
      : {
          screen: "active",
          questionCurrent: phase === "formal" ? formalIndex + 1 : 1,
          questionTotal: phase === "formal" ? FORMAL_QUESTIONS.length : 1,
        }
  );

  useEffect(() => {
    if (phase === "formal") {
      questionStartTsRef.current = performance.now();
    }
  }, [phase, formalIndex]);

  useEffect(() => {
    if ((phase === "practice" || phase === "formal") && selected !== null) {
      handleSubmit();
    }
  }, [phase, selected]);

  function handleSubmit() {
    if (selected === null) return;
    const isCorrect = selected === correct;
    if (phase === "practice") {
      setPracticeCorrect(isCorrect);
      setSelected(null);
      return;
    }
    if (phase === "formal") {
      const nextCorrectCount = formalCorrectCount + (isCorrect ? 1 : 0);
      const rtMs = Math.max(0, performance.now() - questionStartTsRef.current);
      if (isCorrect && rtMs >= 200 && rtMs <= 10000) {
        formalCorrectRtMsRef.current.push(rtMs);
      }
      if (formalIndex + 1 >= FORMAL_QUESTIONS.length) {
        const accuracyPct = (nextCorrectCount / FORMAL_QUESTIONS.length) * 100;
        const medianRtMs = median(formalCorrectRtMsRef.current);
        const score = computeAgeNormScore(
          accuracyPct,
          medianRtMs,
          ageBand,
          FORMAL_QUESTIONS.length
        );
        onComplete(score);
        return;
      }
      setFormalCorrectCount(nextCorrectCount);
      setFormalIndex((idx) => idx + 1);
      setSelected(null);
    }
  }

  if (phase === "intro") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("patternTitle")}</h4>
        <p className="mb-4 text-sm text-gray-600">{t("patternDesc")}</p>
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
        {phase === "practice" ? t("practiceTitle") : t("patternTitle")}
      </h4>
      <span className="mb-3 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {phase === "practice" ? t("practiceBadge") : t("formalBadge")}
      </span>
      {phase === "practice" && <p className="mb-4 text-sm text-gray-600">{t("patternDesc")}</p>}
      {phase === "formal" && (
        <p className="mb-2 text-xs text-gray-500">
          {t("formalProgress", { current: formalIndex + 1, total: FORMAL_QUESTIONS.length })}
        </p>
      )}
      <p className="mb-2 font-mono text-lg">
        {t("tiChainLine", { chain: formatChain(currentQuestion.chain) })}
      </p>
      <p className="mb-3 font-mono text-lg">
        {t("tiCompareLine", { left: currentQuestion.left, right: currentQuestion.right })}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`rounded-lg border-2 px-4 py-2 font-mono ${
              selected === key ? "border-[#5E81AC] bg-[#5E81AC] text-white" : "border-gray-300"
            }`}
          >
            {t(`tiOption.${key}`, { left: currentQuestion.left, right: currentQuestion.right })}
          </button>
        ))}
      </div>
      {phase === "practice" && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${practiceCorrect ? "text-emerald-600" : "text-red-600"}`}>
            {practiceCorrect === null
              ? t("practiceNoAnswer")
              : practiceCorrect
                ? t("practiceFeedbackCorrect")
                : t("practiceFeedbackWrong")}
          </p>
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
