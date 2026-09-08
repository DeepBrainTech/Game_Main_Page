"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

interface AnalogyQuestion {
  id: string;
  leftA: string;
  leftB: string;
  rightA: string;
  options: string[];
  correct: string;
}

function isSymbolHeavy(text: string) {
  return /[^\w\s]/.test(text);
}

const PRACTICE_QUESTION: AnalogyQuestion = {
  id: "practice-1",
  leftA: "Bird",
  leftB: "Sky",
  rightA: "Fish",
  options: ["Forest", "Water", "Desert", "Mountain"],
  correct: "Water",
};

const FORMAL_QUESTIONS: AnalogyQuestion[] = [
  { id: "f-1", leftA: "Hand", leftB: "Glove", rightA: "Foot", options: ["Hat", "Sock", "Shoe", "Belt"], correct: "Shoe" },
  { id: "f-2", leftA: "Puppy", leftB: "Dog", rightA: "Kitten", options: ["Cow", "Cat", "Fox", "Goat"], correct: "Cat" },
  { id: "f-3", leftA: "Knife", leftB: "Cut", rightA: "Pen", options: ["Write", "Drink", "Walk", "Listen"], correct: "Write" },
  { id: "f-4", leftA: "Winter", leftB: "Cold", rightA: "Summer", options: ["Hot", "Wet", "Dry", "Windy"], correct: "Hot" },
  { id: "f-5", leftA: "Teacher", leftB: "School", rightA: "Doctor", options: ["Factory", "Hospital", "Airport", "Museum"], correct: "Hospital" },
  { id: "f-6", leftA: "Square", leftB: "4", rightA: "Triangle", options: ["2", "3", "5", "6"], correct: "3" },
  { id: "f-7", leftA: "Bee", leftB: "Hive", rightA: "Bird", options: ["Nest", "Cave", "Pond", "Cloud"], correct: "Nest" },
  { id: "f-8", leftA: "Eye", leftB: "See", rightA: "Ear", options: ["Smell", "Touch", "Hear", "Taste"], correct: "Hear" },
  { id: "f-9", leftA: "Seed", leftB: "Tree", rightA: "Egg", options: ["Leaf", "Chicken", "Milk", "Feather"], correct: "Chicken" },
  { id: "f-10", leftA: "Author", leftB: "Book", rightA: "Composer", options: ["Photo", "Music", "Code", "Paint"], correct: "Music" },
  { id: "f-11", leftA: "Brush", leftB: "Paint", rightA: "Broom", options: ["Fly", "Sweep", "Melt", "Build"], correct: "Sweep" },
  { id: "f-12", leftA: "Saturn", leftB: "Planet", rightA: "Nile", options: ["Ocean", "River", "Forest", "Island"], correct: "River" },
  // 图形类比题（原创）：用符号表达图形变化关系。
  { id: "f-13", leftA: "△", leftB: "▲", rightA: "○", options: ["●", "□", "◇", "◎"], correct: "●" },
  { id: "f-14", leftA: "△", leftB: "△△", rightA: "○", options: ["○○", "●", "◐", "◎"], correct: "○○" },
  { id: "f-15", leftA: "▲●", leftB: "●▲", rightA: "■◆", options: ["■◆", "◆■", "□◇", "◆◆"], correct: "◆■" },
  { id: "f-16", leftA: "↑", leftB: "→", rightA: "←", options: ["↓", "↑", "→", "↘"], correct: "↑" },
  { id: "f-17", leftA: "□", leftB: "■", rightA: "◇", options: ["◆", "◇", "⬡", "□"], correct: "◆" },
  { id: "f-18", leftA: "●○", leftB: "○●", rightA: "▲△", options: ["▲△", "△▲", "▲▲", "△△"], correct: "△▲" },
  { id: "f-19", leftA: "/", leftB: "\\", rightA: "<", options: [">", "^", "<", "v"], correct: ">" },
  { id: "f-20", leftA: "•", leftB: "••", rightA: "◆", options: ["◆◆", "◇◇", "◆", "■◆"], correct: "◆◆" },
  { id: "f-21", leftA: "▲■●", leftB: "▲■", rightA: "◇□○", options: ["◇□", "□○", "◇○", "◇□○"], correct: "◇□" },
  { id: "f-22", leftA: "⇐", leftB: "⇒", rightA: "⇑", options: ["⇒", "⇓", "⇖", "⇗"], correct: "⇓" },
  { id: "f-23", leftA: "□○", leftB: "■●", rightA: "◇△", options: ["◆▲", "◆△", "◇▲", "△◆"], correct: "◆▲" },
  { id: "f-24", leftA: "△□○", leftB: "○□△", rightA: "▲■●", options: ["●■▲", "▲●■", "■▲●", "●▲■"], correct: "●■▲" },
];

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

function getOptionOrder(seed: string, len: number) {
  const arr = Array.from({ length: len }, (_, i) => i);
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
  return arr;
}

function computeScore(accuracyPct: number, medianRtMs: number | null) {
  // 不做年龄分组，直接按正确率为主、反应时为辅计算展示分。
  const accScore = clamp(accuracyPct, 0, 100);
  if (medianRtMs == null) return Math.round(accScore);
  const rtNorm = clamp((3500 - medianRtMs) / (3500 - 700), 0, 1);
  let score = Math.round(accScore * 0.8 + rtNorm * 20);
  if (accuracyPct < 40) score = Math.min(score, 35);
  return clamp(score, 0, 100);
}

export default function AnalogicalReasoning({ onComplete }: { onComplete: (score: number) => void }) {
  const t = useTranslations("test.logic");
  const [phase, setPhase] = useState<"intro" | "practice" | "formal">("intro");
  const [selected, setSelected] = useState<string | null>(null);
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
  const optionOrder = getOptionOrder(currentQuestion.id, currentQuestion.options.length);
  const symbolMode =
    isSymbolHeavy(currentQuestion.leftA) ||
    isSymbolHeavy(currentQuestion.leftB) ||
    isSymbolHeavy(currentQuestion.rightA);

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
    if (!selected) return;
    const isCorrect = selected === currentQuestion.correct;
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
        onComplete(computeScore(accuracyPct, medianRtMs));
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
        <h4 className="mb-2 font-semibold text-gray-800">{t("analogyTitle")}</h4>
        <p className="mb-4 text-sm text-gray-600">{t("analogyDesc")}</p>
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
        {phase === "practice" ? t("analogyPracticeTitle") : t("analogyTitle")}
      </h4>
      <span className="mb-3 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        {phase === "practice" ? t("practiceBadge") : t("formalBadge")}
      </span>
      {phase === "practice" && <p className="mb-4 text-sm text-gray-600">{t("analogyDesc")}</p>}
      {phase === "formal" && (
        <p className="mb-2 text-xs text-gray-500">
          {t("formalProgress", { current: formalIndex + 1, total: FORMAL_QUESTIONS.length })}
        </p>
      )}

      <p
        className={`mb-3 font-semibold text-gray-800 ${
          symbolMode ? "font-mono text-2xl tracking-wide" : "text-base"
        }`}
      >
        {t("analogyPrompt", {
          leftA: currentQuestion.leftA,
          leftB: currentQuestion.leftB,
          rightA: currentQuestion.rightA,
        })}
      </p>

      <div className="flex flex-wrap gap-2">
        {optionOrder.map((idx) => {
          const option = currentQuestion.options[idx];
          return (
            <button
              key={`${currentQuestion.id}-${option}`}
              type="button"
              onClick={() => setSelected(option)}
              className={`rounded-lg border-2 px-5 py-3 ${
                symbolMode ? "min-w-[92px] font-mono text-2xl tracking-wide" : "text-base"
              } ${
                selected === option ? "border-[#5E81AC] bg-[#5E81AC] text-white" : "border-gray-300"
              }`}
            >
              {option}
            </button>
          );
        })}
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
