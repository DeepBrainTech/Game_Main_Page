"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useReportTestChrome } from "../test-ui";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vec3 = [number, number, number];
type Pt2  = [number, number];

interface Trial2D {
  mode: "2d";
  shapeA: Pt2[];
  shapeB: Pt2[];
  rotA: number;   // degrees, rotation for shape A
  rotB: number;   // degrees, rotation for shape B
  isSame: boolean;
}

interface Trial3D {
  mode: "3d";
  shapeA: Vec3[];
  shapeB: Vec3[];
  isSame: boolean;
}

type Trial = Trial2D | Trial3D;

// ─── 2D Shape Library ─────────────────────────────────────────────────────────
// All shapes centered near (0,0), max radius < 38 so they fit any rotation in
// a viewBox of ±42 without clipping.

function mirror2D(shape: Pt2[]): Pt2[] {
  return shape.map(([x, y]) => ([-x, y] as Pt2));
}

interface TwoDQuestionBank {
  id: "Q1" | "Q2" | "Q3" | "Q4" | "Q5";
  forms: Pt2[][];
  forceSame?: boolean;
}

/** Q1 – 3-square symmetric L (all rotations are equivalent -> always SAME) */
const Q1_L3: Pt2[] = [
  [-16, -16], [16, -16], [16, 0], [0, 0], [0, 16], [-16, 16],
];

/** Q2 – long L (4 squares), two chiral forms */
const Q2_LONG_L: Pt2[] = [
  [-16, -24], [0, -24], [0, 8], [16, 8], [16, 24], [-16, 24],
];
const Q2_LONG_L_M: Pt2[] = mirror2D(Q2_LONG_L);

/** Q3 – medium pool: two close-looking bent forms */
const Q3_BENT_A: Pt2[] = [
  [-24, -24], [24, -24], [24, -8], [-8, -8], [-8, 8], [8, 8], [8, 24], [-24, 24],
];
const Q3_BENT_B: Pt2[] = [
  [-24, -24], [8, -24], [8, -8], [24, -8], [24, 24], [-8, 24], [-8, 8], [-24, 8],
];
const Q3_BENT_B_M: Pt2[] = mirror2D(Q3_BENT_B);

/** Q4 – harder: multi-turn shape with arrow head (as requested) */
const Q4_ARROW_BEND_A: Pt2[] = [
  [-34, -8], [-22, -8], [-22, -24], [12, -24], [12, -8],
  [26, -8], [26, -18], [40, 0], [26, 18], [26, 8], [-6, 8],
  [-6, 24], [-34, 24],
];
const Q4_ARROW_BEND_B: Pt2[] = [
  [-34, -24], [0, -24], [0, -10], [14, -10], [14, -24], [30, -24],
  [30, 2], [40, 2], [20, 26], [0, 2], [-10, 2], [-10, 24], [-34, 24],
];
const Q4_ARROW_BEND_B_M: Pt2[] = mirror2D(Q4_ARROW_BEND_B);

/** Q5 – reserved for future hardest bank; temporary hard placeholders */
const Q5_PLACEHOLDER_A: Pt2[] = [
  [-26, -24], [18, -24], [18, -10], [2, -10], [2, 4], [26, 4], [26, 24], [-10, 24], [-10, 10], [-26, 10],
];
const Q5_PLACEHOLDER_B: Pt2[] = [
  [-28, -24], [8, -24], [8, -8], [24, -8], [24, 8], [10, 8], [10, 24], [-28, 24], [-28, 4], [-12, 4], [-12, -8], [-28, -8],
];

const TWO_D_QUESTION_BANKS: TwoDQuestionBank[] = [
  { id: "Q1", forms: [Q1_L3], forceSame: true },
  { id: "Q2", forms: [Q2_LONG_L, Q2_LONG_L_M] },
  { id: "Q3", forms: [Q3_BENT_A, Q3_BENT_B, Q3_BENT_B_M] },
  { id: "Q4", forms: [Q4_ARROW_BEND_A, Q4_ARROW_BEND_B, Q4_ARROW_BEND_B_M] },
  { id: "Q5", forms: [Q5_PLACEHOLDER_A, Q5_PLACEHOLDER_B, mirror2D(Q5_PLACEHOLDER_B)] },
];

// ─── 2D Renderer ──────────────────────────────────────────────────────────────

/**
 * Renders one 2D shape as an SVG polygon.
 * Rotation is applied via SVG transform (clockwise degrees).
 */
function Shape2DView({
  shape, rotation, size = 130,
}: {
  shape: Pt2[]; rotation: number; size?: number;
}) {
  const pts = shape.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox="-46 -46 92 92"
      style={{ display: "block" }}
    >
      <polygon
        points={pts}
        transform={`rotate(${rotation})`}
        fill="#374151"
        stroke="#374151"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── 3D Shape Library ─────────────────────────────────────────────────────────
// Q6–7: 4-cube simple structures (easy)
const C_SIMPLE1: Vec3[] = [[0,0,0],[1,0,0],[2,0,0],[2,1,0]];          // flat L
const C_SIMPLE2: Vec3[] = [[0,0,0],[1,0,0],[1,0,1],[1,1,1]];          // corner step

// Q8–10: 6–7 cube complex structures (Vandenberg-style)
const C_HARD1: Vec3[] = [
  [0,0,0],[1,0,0],[2,0,0],[2,1,0],[2,1,1],[2,1,2],          // L + vertical tower
];
const C_HARD2: Vec3[] = [
  [0,0,0],[0,1,0],[0,2,0],[1,2,0],[1,2,1],[2,2,1],          // hooked arm
];
const C_HARD3: Vec3[] = [
  [0,0,0],[1,0,0],[2,0,0],[2,0,1],[2,1,1],[2,1,2],[1,1,2],  // 7-cube zigzag
];

// ─── 3D Renderer (isometric, line-drawing / wireframe style) ─────────────────
const TW = 36;  // horizontal tile width
const TH = 18;  // horizontal tile height
const ZH = 28;  // cube vertical height

// White / light-gray palette — clean line-drawing look like the reference
const TOP_CLR   = "#FFFFFF";
const RIGHT_CLR = "#D1D5DB";
const LEFT_CLR  = "#9CA3AF";
const STK_CLR   = "#374151";
const STK_W     = "1.2";

function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * (TW / 2), (x + y) * (TH / 2) - z * ZH];
}

function polyStr(corners: Vec3[]): string {
  return corners.map(([x, y, z]) => project(x, y, z).join(",")).join(" ");
}

function IsoCube({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <g>
      <polygon
        points={polyStr([[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]])}
        fill={RIGHT_CLR} stroke={STK_CLR} strokeWidth={STK_W}
      />
      <polygon
        points={polyStr([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]])}
        fill={LEFT_CLR}  stroke={STK_CLR} strokeWidth={STK_W}
      />
      <polygon
        points={polyStr([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]])}
        fill={TOP_CLR}   stroke={STK_CLR} strokeWidth={STK_W}
      />
    </g>
  );
}

function Shape3DView({ cubes, size = 130 }: { cubes: Vec3[]; size?: number }) {
  if (!cubes || cubes.length === 0) {
    return <div style={{ width: size, height: size }} className="rounded-lg bg-gray-100" />;
  }

  const minX = Math.min(...cubes.map(c => c[0]));
  const minY = Math.min(...cubes.map(c => c[1]));
  const minZ = Math.min(...cubes.map(c => c[2]));
  const norm: Vec3[] = cubes.map(([x, y, z]) => [x - minX, y - minY, z - minZ]);

  // Painter's sort: further cubes (larger x+y) drawn first; ties: lower z first
  const sorted = [...norm].sort((a, b) => (b[0]+b[1]) - (a[0]+a[1]) || a[2] - b[2]);

  // Compute bounding box from all 8 corners of every cube
  let minSX = Infinity, minSY = Infinity, maxSX = -Infinity, maxSY = -Infinity;
  for (const [cx, cy, cz] of norm) {
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = 0; dz <= 1; dz++) {
          const [sx, sy] = project(cx+dx, cy+dy, cz+dz);
          if (sx < minSX) minSX = sx;
          if (sy < minSY) minSY = sy;
          if (sx > maxSX) maxSX = sx;
          if (sy > maxSY) maxSY = sy;
        }
      }
    }
  }

  const P = 10;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${minSX-P} ${minSY-P} ${maxSX-minSX+P*2} ${maxSY-minSY+P*2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {sorted.map(([cx, cy, cz], i) => (
        <IsoCube key={i} x={cx} y={cy} z={cz} />
      ))}
    </svg>
  );
}

// ─── 3D Rotations ─────────────────────────────────────────────────────────────
type RotFn = (v: Vec3) => Vec3;

const ROTS: RotFn[] = [
  v => [ v[0],  v[1],  v[2]] as Vec3, // identity
  v => [-v[1],  v[0],  v[2]] as Vec3, // Z +90°
  v => [-v[0], -v[1],  v[2]] as Vec3, // Z +180°
  v => [ v[1], -v[0],  v[2]] as Vec3, // Z +270°
  v => [ v[2],  v[1], -v[0]] as Vec3, // Y +90°
  v => [-v[0],  v[1], -v[2]] as Vec3, // Y +180°
  v => [-v[2],  v[1],  v[0]] as Vec3, // Y +270°
  v => [ v[0], -v[2],  v[1]] as Vec3, // X +90°
];

const MIRROR_X: RotFn = v => [-v[0], v[1], v[2]] as Vec3;

function norm3D(cubes: Vec3[]): Vec3[] {
  if (!cubes.length) return [];
  const mx = Math.min(...cubes.map(c => c[0]));
  const my = Math.min(...cubes.map(c => c[1]));
  const mz = Math.min(...cubes.map(c => c[2]));
  return cubes.map(([x, y, z]): Vec3 => [x - mx, y - my, z - mz]);
}

function applyRot(shape: Vec3[], rot: RotFn): Vec3[] {
  return norm3D(shape.map(rot));
}

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Trial Builders ───────────────────────────────────────────────────────────
const ANGLES_2D = [0, 90, 180, 270];

function pickIdx(rand: () => number, length: number): number {
  return Math.floor(rand() * length);
}

function pickDifferentIdx(rand: () => number, length: number, exclude: number): number {
  if (length <= 1) return exclude;
  let idx = pickIdx(rand, length);
  while (idx === exclude) idx = pickIdx(rand, length);
  return idx;
}

function build2D(
  rand: () => number,
  bank: TwoDQuestionBank,
  forcedSame?: boolean,
): Trial2D {
  const rotA = ANGLES_2D[pickIdx(rand, ANGLES_2D.length)];
  const rotB = ANGLES_2D[pickDifferentIdx(rand, ANGLES_2D.length, ANGLES_2D.indexOf(rotA))];

  const isSame = forcedSame ?? (bank.forceSame ? true : rand() < 0.5);
  const idxA = pickIdx(rand, bank.forms.length);
  const idxB = isSame ? idxA : pickDifferentIdx(rand, bank.forms.length, idxA);

  return {
    mode: "2d",
    shapeA: bank.forms[idxA],
    shapeB: bank.forms[idxB],
    rotA,
    rotB,
    isSame,
  };
}

function build3D(rand: () => number, base: Vec3[], isSame: boolean): Trial3D {
  const rotAIdx = Math.floor(rand() * ROTS.length);
  const shapeA  = applyRot(base, ROTS[rotAIdx]);
  let shapeB: Vec3[];
  if (isSame) {
    const rotBIdx = (rotAIdx + 1 + Math.floor(rand() * (ROTS.length - 1))) % ROTS.length;
    shapeB = applyRot(base, ROTS[rotBIdx]);
  } else {
    const mirrored = norm3D(base.map(MIRROR_X));
    shapeB = applyRot(mirrored, ROTS[Math.floor(rand() * ROTS.length)]);
  }
  return { mode: "3d", shapeA, shapeB, isSame };
}

/** Q6–Q10 keep existing 3D schedule for now. */
const FORMAL_3D_IS_SAME = [true, false, true, false, true];

function buildFormalTrials(seed: number): Trial[] {
  const rand = mulberry32(seed);
  const twoDTrials = TWO_D_QUESTION_BANKS.map((bank, idx) =>
    build2D(rand, bank, idx === 0 ? true : undefined),
  );

  return [
    ...twoDTrials,
    build3D(rand, C_SIMPLE1, FORMAL_3D_IS_SAME[0]),
    build3D(rand, C_SIMPLE2, FORMAL_3D_IS_SAME[1]),
    build3D(rand, C_HARD1,   FORMAL_3D_IS_SAME[2]),
    build3D(rand, C_HARD2,   FORMAL_3D_IS_SAME[3]),
    build3D(rand, C_HARD3,   FORMAL_3D_IS_SAME[4]),
  ];
}

/** Practice: P1 easy-2D-same, P2 easy-3D-same */
function buildPracticeTrials(seed: number): Trial[] {
  const rand = mulberry32(seed);
  return [
    build2D(rand, TWO_D_QUESTION_BANKS[0], true),
    build3D(rand, C_SIMPLE1, true),
  ];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function calcMedian(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid-1] + s[mid]) / 2 : s[mid];
}

/** 75 % accuracy + 25 % speed (7000 ms = 0 pts, 1000 ms = 100 pts). */
function computeScore(correct: number, total: number, rtMs: number[]): number {
  if (!total) return 0;
  const acc     = (correct / total) * 100;
  const med     = calcMedian(rtMs);
  const rtScore = med == null ? 50 : Math.max(0, Math.min(100, ((7000 - med) / 6000) * 100));
  return Math.round(acc * 0.75 + rtScore * 0.25);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FORMAL_SEED    = Math.floor(Date.now() % 2147483647);
const PRACTICE_SEED  = (FORMAL_SEED + 97) % 2147483647;
const FORMAL_COUNT   = 10;
const PRACTICE_COUNT = 2;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShapeRotation({ onComplete }: { onComplete: (score: number) => void }) {
  const t = useTranslations("test.spatial");

  const practiceTrials = useMemo(() => buildPracticeTrials(PRACTICE_SEED), []);
  const formalTrials   = useMemo(() => buildFormalTrials(FORMAL_SEED),     []);

  const [phase,    setPhase]    = useState<"intro" | "practice" | "formal" | "result">("intro");
  const [trialIdx, setTrialIdx] = useState(0);
  const [selected, setSelected] = useState<"same" | "diff" | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [resultData, setResultData] = useState({ correct: 0, total: 0, avgRt: 0, score: 0 });

  const statsRef     = useRef({ correct: 0, total: 0, rtMs: [] as number[] });
  const startTimeRef = useRef<number>(0);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const currentTrial =
    phase === "practice"
      ? practiceTrials[Math.min(trialIdx, practiceTrials.length - 1)]
      : formalTrials[Math.min(trialIdx, formalTrials.length - 1)];

  useReportTestChrome(
    phase === "intro"
      ? { screen: "intro" }
      : {
          screen: "active",
          questionCurrent: trialIdx + 1,
          questionTotal: phase === "practice" ? PRACTICE_COUNT : FORMAL_COUNT,
        }
  );

  // ── Phase helpers ──────────────────────────────────────────────────────────
  const startPractice = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTrialIdx(0); setSelected(null); setFeedback(null);
    setPhase("practice");
    startTimeRef.current = performance.now();
  };

  const startFormal = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTrialIdx(0); setSelected(null); setFeedback(null);
    statsRef.current = { correct: 0, total: 0, rtMs: [] };
    setPhase("formal");
    startTimeRef.current = performance.now();
  };

  // ── Answer handler ────────────────────────────────────────────────────────
  const handleAnswer = (answer: "same" | "diff") => {
    if (selected !== null || !currentTrial) return;
    const rt        = Math.max(0, performance.now() - startTimeRef.current);
    const isCorrect = (answer === "same") === currentTrial.isSame;
    setSelected(answer);

    if (phase === "practice") {
      setFeedback(isCorrect ? "correct" : "wrong");
      return;
    }

    statsRef.current.correct += isCorrect ? 1 : 0;
    statsRef.current.total   += 1;
    statsRef.current.rtMs.push(rt);

    timerRef.current = setTimeout(() => {
      if (trialIdx + 1 >= FORMAL_COUNT) {
        const { correct, total, rtMs } = statsRef.current;
        const score = computeScore(correct, total, rtMs);
        const avgRt = rtMs.length > 0
          ? Math.round(rtMs.reduce((s, v) => s + v, 0) / rtMs.length)
          : 0;
        setResultData({ correct, total, avgRt, score });
        onComplete(score);
        setPhase("result");
      } else {
        setTrialIdx(i => i + 1);
        setSelected(null);
        startTimeRef.current = performance.now();
      }
    }, 380);
  };

  const advancePractice = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (trialIdx + 1 < PRACTICE_COUNT) {
      setTrialIdx(i => i + 1); setSelected(null); setFeedback(null);
      startTimeRef.current = performance.now();
    } else {
      startFormal();
    }
  };

  // ── Shape panel helper ────────────────────────────────────────────────────
  const renderShape = (trial: Trial, showA: boolean, size = 130) => {
    if (trial.mode === "2d") {
      return (
        <Shape2DView
          shape={showA ? trial.shapeA : trial.shapeB}
          rotation={showA ? trial.rotA : trial.rotB}
          size={size}
        />
      );
    }
    return <Shape3DView cubes={showA ? trial.shapeA : trial.shapeB} size={size} />;
  };

  const modeTag = (trial: Trial) =>
    trial.mode === "2d"
      ? { label: t("mode2d"), cls: "bg-blue-50 text-blue-600" }
      : { label: t("mode3d"), cls: "bg-amber-50 text-amber-700" };

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const demo2D = build2D(mulberry32(99),  TWO_D_QUESTION_BANKS[0], true);
    const demo3D = build3D(mulberry32(100), C_SIMPLE1, false);
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("title")}</h4>
        <p className="mb-4 text-sm text-gray-600">{t("intro")}</p>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {t("introTip")}
          </p>
          <ul className="space-y-1.5 text-xs text-amber-700">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-emerald-600">✓</span>{t("introTip1")}
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-red-500">✗</span>{t("introTip2")}
            </li>
          </ul>
        </div>

        {/* Mini demos: 2D and 3D examples */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-center text-xs font-medium text-blue-500">{t("introSection2d")}</p>
            <div className="flex items-center justify-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">A</span>
                <div className="rounded-lg border border-gray-200 bg-white p-1">
                  <Shape2DView shape={demo2D.shapeA} rotation={demo2D.rotA} size={70} />
                </div>
              </div>
              <span className="text-xs text-gray-300">VS</span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">B</span>
                <div className="rounded-lg border border-gray-200 bg-white p-1">
                  <Shape2DView shape={demo2D.shapeB} rotation={demo2D.rotB} size={70} />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-center text-xs font-medium text-amber-600">{t("introSection3d")}</p>
            <div className="flex items-center justify-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">A</span>
                <div className="rounded-lg border border-gray-200 bg-white p-1">
                  <Shape3DView cubes={demo3D.shapeA} size={70} />
                </div>
              </div>
              <span className="text-xs text-gray-300">VS</span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">B</span>
                <div className="rounded-lg border border-gray-200 bg-white p-1">
                  <Shape3DView cubes={demo3D.shapeB} size={70} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={startPractice}
          className="rounded-lg bg-[#5E81AC] px-4 py-2 text-sm font-medium text-white hover:bg-[#4E719C]"
        >
          {t("startPractice")}
        </button>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const pct = resultData.total > 0
      ? Math.round((resultData.correct / resultData.total) * 100)
      : 0;
    return (
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h4 className="mb-2 font-semibold text-gray-800">{t("resultTitle")}</h4>
        <p className="mb-4 text-sm text-gray-600">{t("resultDesc")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{t("resultAccuracyLabel")}</p>
            <p className="text-lg font-semibold text-gray-800">
              {resultData.correct}/{resultData.total}
              <span className="ml-1 text-sm font-normal text-gray-400">({pct}%)</span>
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{t("resultRtLabel")}</p>
            <p className="text-lg font-semibold text-gray-800">{resultData.avgRt} ms</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
            <p className="text-xs text-gray-500">{t("displayScoreLabel")}</p>
            <p className="text-2xl font-bold text-[#5E81AC]">{resultData.score}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">{t("resultScoreHint")}</p>
      </div>
    );
  }

  // ── Practice / Formal ──────────────────────────────────────────────────────
  const isPractice = phase === "practice";
  const totalCount = isPractice ? PRACTICE_COUNT : FORMAL_COUNT;
  const tag        = modeTag(currentTrial);

  // Progress section label (formal only)
  const sectionLabel =
    !isPractice && trialIdx < 5 ? t("section2d") :
    !isPractice                 ? t("section3d") : "";

  return (
    <div className="rounded-xl bg-white p-6 shadow-md">

      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">
          {isPractice ? t("practiceTitle") : t("formalTitle")}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tag.cls}`}>
            {tag.label}
          </span>
          <span className="rounded-full bg-[#EFF3F8] px-2.5 py-0.5 text-xs font-medium text-[#5E81AC]">
            {isPractice ? t("practiceBadge") : t("formalBadge")}
          </span>
        </div>
      </div>

      <p className="mb-4 text-xs text-gray-400">
        {t("progress", { current: trialIdx + 1, total: totalCount })}
        {sectionLabel && <span className="ml-2">· {sectionLabel}</span>}
      </p>

      {/* Shape panels */}
      <div className="mb-5 flex items-center justify-center gap-4">
        {(["A", "B"] as const).map((label, i) => {
          const showA = i === 0;
          const is2D  = currentTrial.mode === "2d";
          return (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                {label === "A" ? t("shapeA") : t("shapeB")}
              </span>
              <div
                className={`rounded-xl border-2 border-gray-100 p-2
                  ${is2D ? "bg-white" : "bg-gray-50"}`}
              >
                {renderShape(currentTrial, showA)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Practice feedback */}
      {isPractice && feedback && (
        <p className={`mb-3 text-center text-sm font-semibold ${
          feedback === "correct" ? "text-emerald-600" : "text-red-500"
        }`}>
          {feedback === "correct" ? t("practiceFeedbackCorrect") : t("practiceFeedbackWrong")}
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({currentTrial.isSame ? t("answerWasSame") : t("answerWasDiff")})
          </span>
        </p>
      )}

      {/* Question */}
      <p className="mb-3 text-center text-sm font-medium text-gray-700">
        {t("question")}
      </p>

      {/* Answer buttons */}
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => handleAnswer("same")}
          disabled={selected !== null}
          className={`flex-1 max-w-[180px] rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors
            ${selected === "same"
              ? "border-[#5E81AC] bg-[#5E81AC] text-white"
              : "border-gray-200 bg-white text-gray-700 hover:border-[#5E81AC] hover:bg-[#EFF3F8]"}
            disabled:cursor-not-allowed`}
        >
          {t("answerSame")}
        </button>
        <button
          type="button"
          onClick={() => handleAnswer("diff")}
          disabled={selected !== null}
          className={`flex-1 max-w-[180px] rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors
            ${selected === "diff"
              ? "border-red-500 bg-red-500 text-white"
              : "border-gray-200 bg-white text-gray-700 hover:border-red-400 hover:bg-red-50"}
            disabled:cursor-not-allowed`}
        >
          {t("answerDiff")}
        </button>
      </div>

      {/* Practice: manual advance */}
      {isPractice && selected !== null && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={advancePractice}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            {trialIdx + 1 < PRACTICE_COUNT ? t("nextTrial") : t("startFormal")}
          </button>
        </div>
      )}

      {/* Formal: progress bar (two-colour: blue for 2D, amber for 3D) */}
      {!isPractice && (
        <div className="mt-5">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
            {/* 2D portion: blue */}
            <div
              className="h-full bg-blue-400 transition-all duration-300"
              style={{ width: `${Math.min(trialIdx, 5) / FORMAL_COUNT * 100}%` }}
            />
            {/* 3D portion: amber */}
            {trialIdx >= 5 && (
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${(trialIdx - 5) / FORMAL_COUNT * 100}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-300">
            <span>2D</span>
            <span>3D</span>
          </div>
        </div>
      )}
    </div>
  );
}
