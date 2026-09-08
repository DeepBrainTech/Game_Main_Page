"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

type OptionKey = "entailed" | "notEntailed" | "indeterminate";
type AgeBandId = "children" | "preteens" | "teens" | "youngAdults" | "middleAged" | "seniors";

interface AgeNormRange {
  accMin: number;
  accMax: number;
  rtMin: number;
  rtMax: number;
}

interface SyllogismQuestion {
  id: string;
  premise1: string;
  premise2: string;
  conclusion: string;
  answer: OptionKey;
}

const PRACTICE_QUESTION: SyllogismQuestion = {
  id: "practice-1",
  premise1: "All roses are flowers.",
  premise2: "All flowers are plants.",
  conclusion: "All roses are plants.",
  answer: "entailed",
};

const FORMAL_QUESTIONS: SyllogismQuestion[] = [
  {
    id: "f-1",
    premise1: "All cats are mammals.",
    premise2: "All mammals are animals.",
    conclusion: "All cats are animals.",
    answer: "entailed",
  },
  {
    id: "f-2",
    premise1: "All students are readers.",
    premise2: "Some readers are athletes.",
    conclusion: "Some students are athletes.",
    answer: "indeterminate",
  },
  {
    id: "f-3",
    premise1: "No birds are mammals.",
    premise2: "All sparrows are birds.",
    conclusion: "No sparrows are mammals.",
    answer: "entailed",
  },
  {
    id: "f-4",
    premise1: "All poets are dreamers.",
    premise2: "No dreamers are robots.",
    conclusion: "Some poets are robots.",
    answer: "notEntailed",
  },
  {
    id: "f-5",
    premise1: "Some musicians are teachers.",
    premise2: "All teachers are patient.",
    conclusion: "Some musicians are patient.",
    answer: "entailed",
  },
  {
    id: "f-6",
    premise1: "All squares are rectangles.",
    premise2: "All rectangles are polygons.",
    conclusion: "No squares are polygons.",
    answer: "notEntailed",
  },
  {
    id: "f-7",
    premise1: "Some doctors are researchers.",
    premise2: "Some researchers are writers.",
    conclusion: "Some doctors are writers.",
    answer: "indeterminate",
  },
  {
    id: "f-8",
    premise1: "No fruits are metals.",
    premise2: "All apples are fruits.",
    conclusion: "No apples are metals.",
    answer: "entailed",
  },
  {
    id: "f-9",
    premise1: "All engineers are problem-solvers.",
    premise2: "Some artists are not problem-solvers.",
    conclusion: "Some artists are not engineers.",
    answer: "entailed",
  },
  {
    id: "f-10",
    premise1: "All planets orbit stars.",
    premise2: "Some moons orbit planets.",
    conclusion: "Some moons orbit stars.",
    answer: "indeterminate",
  },
  {
    id: "f-11",
    premise1: "No reptiles are warm-blooded.",
    premise2: "All snakes are reptiles.",
    conclusion: "Some snakes are warm-blooded.",
    answer: "notEntailed",
  },
  {
    id: "f-12",
    premise1: "Some books are novels.",
    premise2: "All novels are stories.",
    conclusion: "Some books are stories.",
    answer: "entailed",
  },
  {
    id: "f-13",
    premise1: "All pianists are musicians.",
    premise2: "No musicians are stones.",
    conclusion: "No pianists are stones.",
    answer: "entailed",
  },
  {
    id: "f-14",
    premise1: "All teachers are employees.",
    premise2: "Some employees are managers.",
    conclusion: "Some teachers are managers.",
    answer: "indeterminate",
  },
  {
    id: "f-15",
    premise1: "No fish are mammals.",
    premise2: "All dolphins are mammals.",
    conclusion: "Some dolphins are fish.",
    answer: "notEntailed",
  },
  {
    id: "f-16",
    premise1: "Some cars are electric.",
    premise2: "All electric vehicles are quiet.",
    conclusion: "All cars are quiet.",
    answer: "indeterminate",
  },
  {
    id: "f-17",
    premise1: "All bakers are workers.",
    premise2: "No workers are trees.",
    conclusion: "Some bakers are trees.",
    answer: "notEntailed",
  },
  {
    id: "f-18",
    premise1: "All swimmers are athletes.",
    premise2: "Some athletes are doctors.",
    conclusion: "No swimmers are doctors.",
    answer: "indeterminate",
  },
  {
    id: "f-19",
    premise1: "No insects are birds.",
    premise2: "All ants are insects.",
    conclusion: "No ants are birds.",
    answer: "entailed",
  },
  {
    id: "f-20",
    premise1: "All coders are logical.",
    premise2: "Some students are not logical.",
    conclusion: "Some students are coders.",
    answer: "notEntailed",
  },
  {
    id: "f-21",
    premise1: "Some flowers are red.",
    premise2: "Some roses are flowers.",
    conclusion: "Some roses are red.",
    answer: "indeterminate",
  },
  {
    id: "f-22",
    premise1: "All pilots are trained.",
    premise2: "No trained people are unlicensed.",
    conclusion: "Some pilots are unlicensed.",
    answer: "notEntailed",
  },
  {
    id: "f-23",
    premise1: "Some laptops are expensive.",
    premise2: "All expensive items are insured.",
    conclusion: "No laptops are insured.",
    answer: "notEntailed",
  },
  {
    id: "f-24",
    premise1: "All apples are fruits.",
    premise2: "Some fruits are imported.",
    conclusion: "Some apples are imported.",
    answer: "indeterminate",
  },
];

const AGE_NORMS: Record<AgeBandId, AgeNormRange> = {
  children: { accMin: 50, accMax: 65, rtMin: 1500, rtMax: 2500 }, // 6-9
  preteens: { accMin: 60, accMax: 75, rtMin: 1200, rtMax: 2000 }, // 10-12
  teens: { accMin: 70, accMax: 85, rtMin: 900, rtMax: 1500 }, // 13-17
  youngAdults: { accMin: 85, accMax: 95, rtMin: 700, rtMax: 1200 }, // 18-30
  middleAged: { accMin: 80, accMax: 90, rtMin: 800, rtMax: 1300 }, // 31-59
  seniors: { accMin: 65, accMax: 85, rtMin: 1000, rtMax: 1800 }, // 60+
};

function getOptionOrder(): OptionKey[] {
  // 选项顺序固定，避免位置变化影响作答策略。
  return ["entailed", "notEntailed", "indeterminate"];
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
  if (age >= 6 && age <= 9) return "children";
  if (age >= 10 && age <= 12) return "preteens";
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

  // 题量不足时降低置信度影响；准确率过低时限制上限。
  if (totalAnswered < 10) score = Math.round(score * 0.9);
  if (accuracyPct < 50) score = Math.min(score, 40);
  return clamp(score, 0, 100);
}

export default function SyllogisticReasoning({
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
  const options = getOptionOrder();
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
    const isCorrect = selected === currentQuestion.answer;
    if (phase === "practice") {
      setPracticeCorrect(isCorrect);
      setSelected(null);
      return;
    }
    if (phase === "formal") {
      const nextCorrectCount = formalCorrectCount + (isCorrect ? 1 : 0);
      const rtMs = Math.max(0, performance.now() - questionStartTsRef.current);
      if (isCorrect && rtMs >= 200 && rtMs <= 15000) {
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
        <h4 className="mb-2 font-semibold text-gray-800">{t("syllogismTitle")}</h4>
        <p className="mb-4 text-sm text-gray-600">{t("syllogismDesc")}</p>
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
        {phase === "practice" ? t("syllogismPracticeTitle") : t("syllogismTitle")}
      </h4>
      <span className="mb-3 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {phase === "practice" ? t("practiceBadge") : t("formalBadge")}
      </span>
      {phase === "practice" && <p className="mb-4 text-sm text-gray-600">{t("syllogismDesc")}</p>}
      {phase === "formal" && (
        <p className="mb-2 text-xs text-gray-500">
          {t("formalProgress", { current: formalIndex + 1, total: FORMAL_QUESTIONS.length })}
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <p>{t("syllogismPremise1", { text: currentQuestion.premise1 })}</p>
        <p>{t("syllogismPremise2", { text: currentQuestion.premise2 })}</p>
        <p className="font-semibold">
          {t("syllogismConclusion", { text: currentQuestion.conclusion })}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected(key)}
            className={`rounded-lg border-2 px-4 py-2 ${
              selected === key ? "border-[#5E81AC] bg-[#5E81AC] text-white" : "border-gray-300"
            }`}
          >
            {t(`syllogismOption.${key}`)}
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
