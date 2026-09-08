"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReportTestChrome } from "../test-ui";

type FoldDirection = "leftToRight" | "rightToLeft" | "topToBottom" | "bottomToTop";

interface FoldStep {
  dir: FoldDirection;
}

interface GridPoint {
  x: number;
  y: number;
}

interface Question {
  id: string;
  width: number;
  height: number;
  folds: FoldStep[];
  punch: GridPoint;
}

interface BuiltTrial {
  question: Question;
  correctPattern: GridPoint[];
  options: GridPoint[][];
  correctOption: number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pointKey(p: GridPoint): string {
  return `${p.x},${p.y}`;
}

function normalizePattern(pattern: GridPoint[]): GridPoint[] {
  return [...pattern].sort((a, b) => a.y - b.y || a.x - b.x);
}

function patternKey(pattern: GridPoint[]): string {
  return normalizePattern(pattern).map(pointKey).join("|");
}

function buildInitialMap(width: number, height: number): GridPoint[][][] {
  const grid: GridPoint[][][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: GridPoint[][] = [];
    for (let x = 0; x < width; x += 1) {
      row.push([{ x, y }]);
    }
    grid.push(row);
  }
  return grid;
}

function foldLeftToRight(grid: GridPoint[][][]): GridPoint[][][] {
  const height = grid.length;
  const width = grid[0].length;
  const mid = width / 2;
  const out: GridPoint[][][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: GridPoint[][] = [];
    for (let x = 0; x < mid; x += 1) {
      const keep = grid[y][x + mid];
      const foldFrom = grid[y][mid - 1 - x];
      row.push([...keep, ...foldFrom]);
    }
    out.push(row);
  }
  return out;
}

function foldRightToLeft(grid: GridPoint[][][]): GridPoint[][][] {
  const height = grid.length;
  const width = grid[0].length;
  const mid = width / 2;
  const out: GridPoint[][][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: GridPoint[][] = [];
    for (let x = 0; x < mid; x += 1) {
      const keep = grid[y][x];
      const foldFrom = grid[y][width - 1 - x];
      row.push([...keep, ...foldFrom]);
    }
    out.push(row);
  }
  return out;
}

function foldTopToBottom(grid: GridPoint[][][]): GridPoint[][][] {
  const height = grid.length;
  const width = grid[0].length;
  const mid = height / 2;
  const out: GridPoint[][][] = [];
  for (let y = 0; y < mid; y += 1) {
    const row: GridPoint[][] = [];
    for (let x = 0; x < width; x += 1) {
      const keep = grid[y + mid][x];
      const foldFrom = grid[mid - 1 - y][x];
      row.push([...keep, ...foldFrom]);
    }
    out.push(row);
  }
  return out;
}

function foldBottomToTop(grid: GridPoint[][][]): GridPoint[][][] {
  const height = grid.length;
  const width = grid[0].length;
  const mid = height / 2;
  const out: GridPoint[][][] = [];
  for (let y = 0; y < mid; y += 1) {
    const row: GridPoint[][] = [];
    for (let x = 0; x < width; x += 1) {
      const keep = grid[y][x];
      const foldFrom = grid[height - 1 - y][x];
      row.push([...keep, ...foldFrom]);
    }
    out.push(row);
  }
  return out;
}

function simulateCorrectPattern(question: Question): GridPoint[] {
  let grid = buildInitialMap(question.width, question.height);
  for (const step of question.folds) {
    const width = grid[0].length;
    const height = grid.length;
    if ((step.dir === "leftToRight" || step.dir === "rightToLeft") && width % 2 !== 0) {
      throw new Error(`Invalid vertical fold width for ${question.id}`);
    }
    if ((step.dir === "topToBottom" || step.dir === "bottomToTop") && height % 2 !== 0) {
      throw new Error(`Invalid horizontal fold height for ${question.id}`);
    }
    if (step.dir === "leftToRight") grid = foldLeftToRight(grid);
    else if (step.dir === "rightToLeft") grid = foldRightToLeft(grid);
    else if (step.dir === "topToBottom") grid = foldTopToBottom(grid);
    else grid = foldBottomToTop(grid);
  }

  const finalH = grid.length;
  const finalW = grid[0].length;
  if (
    question.punch.x < 0 ||
    question.punch.y < 0 ||
    question.punch.x >= finalW ||
    question.punch.y >= finalH
  ) {
    throw new Error(`Punch out of range for ${question.id}`);
  }

  return normalizePattern(grid[question.punch.y][question.punch.x]);
}

function mirrorX(pattern: GridPoint[], width: number): GridPoint[] {
  return normalizePattern(pattern.map((p) => ({ x: width - 1 - p.x, y: p.y })));
}

function mirrorY(pattern: GridPoint[], height: number): GridPoint[] {
  return normalizePattern(pattern.map((p) => ({ x: p.x, y: height - 1 - p.y })));
}

function rotate180(pattern: GridPoint[], width: number, height: number): GridPoint[] {
  return normalizePattern(pattern.map((p) => ({ x: width - 1 - p.x, y: height - 1 - p.y })));
}

function shiftPattern(pattern: GridPoint[], width: number, height: number, dx: number, dy: number): GridPoint[] {
  return normalizePattern(
    pattern.map((p) => ({
      x: (p.x + dx + width) % width,
      y: (p.y + dy + height) % height,
    })),
  );
}

function buildOptions(
  correctPattern: GridPoint[],
  width: number,
  height: number,
  rand: () => number,
): { options: GridPoint[][]; correctOption: number } {
  const candidates: GridPoint[][] = [
    mirrorX(correctPattern, width),
    mirrorY(correctPattern, height),
    rotate180(correctPattern, width, height),
    shiftPattern(correctPattern, width, height, 1, 0),
    shiftPattern(correctPattern, width, height, 0, 1),
    shiftPattern(correctPattern, width, height, 1, 1),
  ];

  const used = new Set<string>([patternKey(correctPattern)]);
  const wrongs: GridPoint[][] = [];
  for (const c of candidates) {
    const key = patternKey(c);
    if (!used.has(key)) {
      used.add(key);
      wrongs.push(c);
    }
    if (wrongs.length >= 2) break;
  }

  // Safety fallback: mutate one point if symmetry made candidates collide.
  while (wrongs.length < 2) {
    const clone = correctPattern.map((p) => ({ ...p }));
    const idx = Math.floor(rand() * clone.length);
    clone[idx] = {
      x: (clone[idx].x + 1) % width,
      y: (clone[idx].y + 1) % height,
    };
    const normalized = normalizePattern(clone);
    const key = patternKey(normalized);
    if (!used.has(key)) {
      used.add(key);
      wrongs.push(normalized);
    }
  }

  const options: GridPoint[][] = [correctPattern, wrongs[0], wrongs[1]];
  shuffleInPlace(options, rand);
  return { options, correctOption: options.findIndex((op) => patternKey(op) === patternKey(correctPattern)) };
}

function buildTrial(question: Question, seed: number): BuiltTrial {
  const rand = mulberry32(seed);
  const correctPattern = simulateCorrectPattern(question);
  const { options, correctOption } = buildOptions(correctPattern, question.width, question.height, rand);
  return { question, correctPattern, options, correctOption };
}

function calcMedian(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function computeScore(correct: number, total: number, rtMs: number[]): number {
  if (!total) return 0;
  const acc = (correct / total) * 100;
  const med = calcMedian(rtMs);
  const rtScore = med == null ? 50 : Math.max(0, Math.min(100, ((8000 - med) / 7000) * 100));
  return Math.round(acc * 0.75 + rtScore * 0.25);
}

function foldText(dir: FoldDirection): string {
  if (dir === "leftToRight") return "Fold left half to right";
  if (dir === "rightToLeft") return "Fold right half to left";
  if (dir === "topToBottom") return "Fold top half downward";
  return "Fold bottom half upward";
}

function StepBoard({
  width,
  height,
  fold,
  punch,
}: {
  width: number;
  height: number;
  fold?: FoldDirection;
  punch?: GridPoint;
}) {
  const unit = 18;
  const pad = 10;
  const boardW = width * unit;
  const boardH = height * unit;
  const totalW = boardW + pad * 2;
  const totalH = boardH + pad * 2;
  const midX = pad + boardW / 2;
  const midY = pad + boardH / 2;

  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="rounded-md bg-white">
      <rect x={pad} y={pad} width={boardW} height={boardH} fill="#F4C983" stroke="#374151" strokeWidth="1.5" />
      {fold && (fold === "leftToRight" || fold === "rightToLeft") && (
        <line x1={midX} y1={pad} x2={midX} y2={pad + boardH} stroke="#1F2937" strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {fold && (fold === "topToBottom" || fold === "bottomToTop") && (
        <line x1={pad} y1={midY} x2={pad + boardW} y2={midY} stroke="#1F2937" strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {fold === "leftToRight" && (
        <text x={pad + 4} y={pad + boardH - 4} fontSize="10" fill="#1F2937">→</text>
      )}
      {fold === "rightToLeft" && (
        <text x={pad + boardW - 12} y={pad + boardH - 4} fontSize="10" fill="#1F2937">←</text>
      )}
      {fold === "topToBottom" && (
        <text x={pad + boardW - 12} y={pad + 12} fontSize="10" fill="#1F2937">↓</text>
      )}
      {fold === "bottomToTop" && (
        <text x={pad + boardW - 12} y={pad + boardH - 4} fontSize="10" fill="#1F2937">↑</text>
      )}
      {punch && (
        <circle
          cx={pad + (punch.x + 0.5) * unit}
          cy={pad + (punch.y + 0.5) * unit}
          r={3.2}
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}

function PatternBoard({
  width,
  height,
  holes,
}: {
  width: number;
  height: number;
  holes: GridPoint[];
}) {
  const unit = 20;
  const pad = 10;
  const boardW = width * unit;
  const boardH = height * unit;
  const totalW = boardW + pad * 2;
  const totalH = boardH + pad * 2;
  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
      <rect x={pad} y={pad} width={boardW} height={boardH} fill="#F4C983" stroke="#374151" strokeWidth="1.6" />
      {holes.map((h) => (
        <circle
          key={`${h.x}-${h.y}`}
          cx={pad + (h.x + 0.5) * unit}
          cy={pad + (h.y + 0.5) * unit}
          r={4}
          fill="#FFFFFF"
          stroke="#111827"
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}

function SequenceView({ trial }: { trial: BuiltTrial }) {
  const dims = [{ width: trial.question.width, height: trial.question.height }];
  let currentW = trial.question.width;
  let currentH = trial.question.height;
  for (const fold of trial.question.folds) {
    if (fold.dir === "leftToRight" || fold.dir === "rightToLeft") currentW /= 2;
    else currentH /= 2;
    dims.push({ width: currentW, height: currentH });
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="rounded bg-gray-200 px-2 py-0.5 font-medium text-gray-700">Fold sequence</span>
        {trial.question.folds.map((f, i) => (
          <span key={`${trial.question.id}-text-${i}`}>{`Step ${i + 1}: ${foldText(f.dir)}`}</span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-gray-500">Start</span>
          <StepBoard width={dims[0].width} height={dims[0].height} fold={trial.question.folds[0]?.dir} />
        </div>
        {trial.question.folds.map((fold, i) => (
          <div key={`${trial.question.id}-fold-${i}`} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-gray-500">{`After fold ${i + 1}`}</span>
            <StepBoard
              width={dims[i + 1].width}
              height={dims[i + 1].height}
              fold={trial.question.folds[i + 1]?.dir}
              punch={i === trial.question.folds.length - 1 ? trial.question.punch : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const QUESTION_BANK: Question[] = [
  { id: "PF1", width: 4, height: 4, folds: [{ dir: "leftToRight" }], punch: { x: 1, y: 2 } },
  { id: "PF2", width: 4, height: 4, folds: [{ dir: "topToBottom" }], punch: { x: 2, y: 1 } },
  { id: "PF3", width: 4, height: 4, folds: [{ dir: "leftToRight" }, { dir: "topToBottom" }], punch: { x: 1, y: 0 } },
  { id: "PF4", width: 4, height: 4, folds: [{ dir: "topToBottom" }, { dir: "rightToLeft" }], punch: { x: 0, y: 1 } },
  { id: "PF5", width: 4, height: 4, folds: [{ dir: "rightToLeft" }, { dir: "bottomToTop" }], punch: { x: 1, y: 0 } },
  { id: "PF6", width: 4, height: 4, folds: [{ dir: "bottomToTop" }, { dir: "leftToRight" }], punch: { x: 1, y: 1 } },
  { id: "PF7", width: 4, height: 4, folds: [{ dir: "leftToRight" }, { dir: "bottomToTop" }], punch: { x: 0, y: 0 } },
  { id: "PF8", width: 4, height: 4, folds: [{ dir: "topToBottom" }, { dir: "leftToRight" }], punch: { x: 1, y: 1 } },
];

const FORMAL_COUNT = 6;
const PRACTICE_COUNT = 2;
const SEED_BASE = Math.floor(Date.now() % 2147483647);

export default function PaperFold({ onComplete }: { onComplete: (score: number) => void }) {
  const practiceTrials = useMemo(() => {
    return QUESTION_BANK.slice(0, PRACTICE_COUNT).map((q, i) => buildTrial(q, SEED_BASE + i * 19 + 11));
  }, []);

  const formalTrials = useMemo(() => {
    return QUESTION_BANK.slice(PRACTICE_COUNT, PRACTICE_COUNT + FORMAL_COUNT).map((q, i) =>
      buildTrial(q, SEED_BASE + i * 31 + 97),
    );
  }, []);

  const [phase, setPhase] = useState<"intro" | "practice" | "formal" | "result">("intro");
  const [trialIdx, setTrialIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [resultData, setResultData] = useState({ correct: 0, total: 0, avgRt: 0, score: 0 });

  const statsRef = useRef({ correct: 0, total: 0, rtMs: [] as number[] });
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const isPractice = phase === "practice";
  const currentTrial = isPractice
    ? practiceTrials[Math.min(trialIdx, practiceTrials.length - 1)]
    : formalTrials[Math.min(trialIdx, formalTrials.length - 1)];

  useReportTestChrome(
    phase === "intro"
      ? { screen: "intro" }
      : {
          screen: "active",
          questionCurrent: trialIdx + 1,
          questionTotal: isPractice ? PRACTICE_COUNT : FORMAL_COUNT,
        }
  );

  const startPractice = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTrialIdx(0);
    setSelected(null);
    setFeedback(null);
    setPhase("practice");
    startRef.current = performance.now();
  };

  const startFormal = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    statsRef.current = { correct: 0, total: 0, rtMs: [] };
    setTrialIdx(0);
    setSelected(null);
    setFeedback(null);
    setPhase("formal");
    startRef.current = performance.now();
  };

  const onAnswer = (idx: number) => {
    if (!currentTrial || selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === currentTrial.correctOption;
    const rt = Math.max(0, performance.now() - startRef.current);

    if (isPractice) {
      setFeedback(isCorrect ? "correct" : "wrong");
      return;
    }

    statsRef.current.total += 1;
    if (isCorrect) statsRef.current.correct += 1;
    statsRef.current.rtMs.push(rt);

    timerRef.current = setTimeout(() => {
      if (trialIdx + 1 >= FORMAL_COUNT) {
        const { correct, total, rtMs } = statsRef.current;
        const score = computeScore(correct, total, rtMs);
        const avgRt = rtMs.length > 0
          ? Math.round(rtMs.reduce((sum, v) => sum + v, 0) / rtMs.length)
          : 0;
        setResultData({ correct, total, avgRt, score });
        onComplete(score);
        setPhase("result");
        return;
      }
      setTrialIdx((i) => i + 1);
      setSelected(null);
      startRef.current = performance.now();
    }, 420);
  };

  const advancePractice = () => {
    if (trialIdx + 1 < PRACTICE_COUNT) {
      setTrialIdx((i) => i + 1);
      setSelected(null);
      setFeedback(null);
      startRef.current = performance.now();
      return;
    }
    startFormal();
  };

  if (phase === "intro") {
    const demo = practiceTrials[0];
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">Paper Folding (Hole Punch)</h4>
        <p className="mb-3 text-sm text-gray-600">
          A square paper is folded one or more times, then a hole is punched on the folded paper.
          Mentally unfold it and choose the final hole pattern on the original square.
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>Observe the paper shape and fold direction.</li>
          <li>Visualize each unfold in reverse order.</li>
          <li>Use elimination to drop impossible options quickly.</li>
          <li>Choose the pattern that exactly matches symmetry and position.</li>
        </ul>
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="mb-1 font-semibold text-gray-700">Disclaimer</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>This mini-test uses generated items inspired by paper folding mechanics.</li>
            <li>It is designed for training feedback, not as a formal certification exam.</li>
          </ul>
        </div>
        <SequenceView trial={demo} />
        <button
          type="button"
          onClick={startPractice}
          className="rounded-lg bg-[#5E81AC] px-4 py-2 text-sm font-medium text-white hover:bg-[#4E719C]"
        >
          Start Practice
        </button>
      </div>
    );
  }

  if (phase === "result") {
    const pct = resultData.total > 0 ? Math.round((resultData.correct / resultData.total) * 100) : 0;
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">Paper Folding Result</h4>
        <p className="mb-4 text-sm text-gray-600">Your score combines accuracy and response speed.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Accuracy</p>
            <p className="text-lg font-semibold text-gray-800">
              {resultData.correct}/{resultData.total}
              <span className="ml-1 text-sm font-normal text-gray-400">({pct}%)</span>
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Avg response time</p>
            <p className="text-lg font-semibold text-gray-800">{resultData.avgRt} ms</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
            <p className="text-xs text-gray-500">Final score</p>
            <p className="text-2xl font-bold text-[#5E81AC]">{resultData.score}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCount = isPractice ? PRACTICE_COUNT : FORMAL_COUNT;
  const optionLabels = ["A", "B", "C"] as const;

  return (
    <div className="rounded-xl bg-white p-6 shadow-md">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">
          {isPractice ? "Paper Folding Practice" : "Paper Folding Test"}
        </h4>
        <span className="rounded-full bg-[#EFF3F8] px-2.5 py-0.5 text-xs font-medium text-[#5E81AC]">
          {isPractice ? "Practice" : "Formal"}
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-400">Progress {trialIdx + 1}/{totalCount}</p>

      <SequenceView trial={currentTrial} />

      <p className="mb-3 text-center text-sm font-medium text-gray-700">
        Which option shows hole positions on the original (unfolded) square?
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {currentTrial.options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrect = idx === currentTrial.correctOption;
          const selectedWrong = selected !== null && isSelected && !isCorrect;
          const selectedCorrect = selected !== null && isSelected && isCorrect;
          return (
            <button
              key={`${currentTrial.question.id}-option-${idx}`}
              type="button"
              onClick={() => onAnswer(idx)}
              disabled={selected !== null}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${
                selectedCorrect
                  ? "border-emerald-500 bg-emerald-50"
                  : selectedWrong
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200 bg-white hover:border-[#5E81AC]"
              } disabled:cursor-not-allowed`}
            >
              <p className="mb-2 text-xs font-semibold text-gray-500">{optionLabels[idx]}</p>
              <div className="flex justify-center">
                <PatternBoard width={currentTrial.question.width} height={currentTrial.question.height} holes={opt} />
              </div>
            </button>
          );
        })}
      </div>

      {isPractice && feedback && (
        <p className={`mt-3 text-center text-sm font-semibold ${
          feedback === "correct" ? "text-emerald-600" : "text-red-500"
        }`}>
          {feedback === "correct" ? "Correct!" : "Not this one."}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {`Answer: ${optionLabels[currentTrial.correctOption]}`}
          </span>
        </p>
      )}

      {isPractice && selected !== null && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={advancePractice}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {trialIdx + 1 < PRACTICE_COUNT ? "Next" : "Start Formal Test"}
          </button>
        </div>
      )}

      {!isPractice && (
        <div className="mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-[#5E81AC] transition-all duration-300"
              style={{ width: `${(trialIdx / FORMAL_COUNT) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
