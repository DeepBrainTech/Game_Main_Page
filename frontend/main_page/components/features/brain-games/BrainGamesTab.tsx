"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GAMES_BY_DIMENSION } from "@/config/brain-games";
import type { PortalLaunchKey } from "@/config/game-launch";
import { COGNITIVE_DIMENSION_KEYS } from "@/types/cognitive";
import type { GameEntry } from "@/config/brain-games";
import { useGameLikes } from "@/hooks/useGameLikes";
import { postGamePlayedRecord } from "@/services/userApi";
import chessmaterGif from "../../../public/brain-games/chessmater.gif";
import sudokuGif from "../../../public/brain-games/sudoku.gif";
import chessTourmasterGif from "../../../public/brain-games/chessTourmaster.gif";
import quantumGoGif from "../../../public/brain-games/quantumgo.gif";
import fogChessGif from "../../../public/brain-games/fogchess.gif";
import intercontinentalChessGif from "../../../public/brain-games/intercontinental-chess.gif";
import numberBlastGif from "../../../public/brain-games/number-blast.gif";

const GAME_COVER_MAP: Record<string, string | StaticImageData> = {
  chessmater: chessmaterGif,
  sudoku: sudokuGif,
  "chess-tourmaster": chessTourmasterGif,
  quantumgo: quantumGoGif,
  fogchess: fogChessGif,
  "intercontinental-chess": intercontinentalChessGif,
  "number-blast": numberBlastGif,
};

interface BrainGamesTabProps {
  launchByKey: (key: PortalLaunchKey) => void;
}

type FeaturedKey = "fogchess" | "quantumgo";

const FEATURED_GAMES: { key: FeaturedKey; title: string; subtitle: string }[] = [
  { key: "fogchess", title: "FogChess", subtitle: "Hidden information, pure strategy." },
  { key: "quantumgo", title: "Quantum Go", subtitle: "Uncertain moves, precise planning." },
];

/** When Top-3 still has empty slots among 0-like games, pull from these keys first; order shuffled once per load/refresh. */
const RIBBON_ZERO_FILL_KEYS = ["chessmater", "quantumgo", "fogchess"] as const;

const RANK_MEDAL_SRC = ["/brain-games/gold.svg", "/brain-games/silver.svg", "/brain-games/bronze.svg"] as const;

/** Keys accepted by `POST/DELETE /api/games/likes/{game_key}` (see backend `SUPPORTED_GAME_KEYS`). */
const BACKEND_LIKE_GAME_KEYS = new Set<string>([
  "sudoku",
  "intercontinental-chess",
  "mathchess",
  "chessmater",
  "quantumgo",
  "fogchess",
  "chess-tourmaster",
  "dash-dot-simulator",
  "stack_math_chess",
  "recon_chess",
  "soccer_chess",
  "no-king-chess",
]);

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Likeable games that actually appear in this portal (brain-games config). */
const PORTAL_LIKEABLE_GAME_KEYS: string[] = (() => {
  const s = new Set<string>();
  for (const dim of COGNITIVE_DIMENSION_KEYS) {
    for (const e of GAMES_BY_DIMENSION[dim]) {
      if (BACKEND_LIKE_GAME_KEYS.has(e.key)) s.add(e.key);
    }
  }
  return Array.from(s);
})();

function findBrainGameEntry(gameKey: string): GameEntry | undefined {
  for (const dim of COGNITIVE_DIMENSION_KEYS) {
    const found = GAMES_BY_DIMENSION[dim].find((e) => e.key === gameKey);
    if (found) return found;
  }
  return undefined;
}

/**
 * Ribbon top-3: global sort by like count (all portal likeable games).
 * Remaining slots when likes are sparse: fill with 0-like picks from `zeroFillOrder`
 * (shuffled chessmater / quantumgo / fogchess), then any other 0-like portal games if still short.
 */
function computeRibbonTopThree(
  likeCount: (k: string) => number,
  portalKeys: readonly string[],
  zeroFillOrder: readonly string[]
): string[] {
  const picked = new Set<string>();
  const out: string[] = [];

  const positive = portalKeys
    .filter((k) => likeCount(k) > 0)
    .sort((a, b) => likeCount(b) - likeCount(a) || a.localeCompare(b));

  for (const k of positive) {
    if (out.length >= 3) break;
    out.push(k);
    picked.add(k);
  }

  for (const k of zeroFillOrder) {
    if (out.length >= 3) break;
    if (!portalKeys.includes(k)) continue;
    if (picked.has(k)) continue;
    if (likeCount(k) !== 0) continue;
    out.push(k);
    picked.add(k);
  }

  if (out.length < 3) {
    const rest = portalKeys
      .filter((k) => !picked.has(k) && likeCount(k) === 0)
      .sort((a, b) => a.localeCompare(b));
    for (const k of rest) {
      if (out.length >= 3) break;
      out.push(k);
      picked.add(k);
    }
  }

  return out.slice(0, 3);
}

/** Featured + ranking row unified min-height (prior ~280→308, then +≈10% for breathing room). */
const FEATURE_ROW_MIN_H_PX = 339;
const CATEGORY_ORDER: (typeof COGNITIVE_DIMENSION_KEYS)[number][] = [
  "strategy",
  "spatial",
  "memory",
  "logic",
  "focus",
  "reaction",
];

type GameCategoryFilter = (typeof COGNITIVE_DIMENSION_KEYS)[number] | null;

function allPortalGames(): GameEntry[] {
  const seen = new Set<string>();
  const out: GameEntry[] = [];
  for (const dim of CATEGORY_ORDER) {
    for (const entry of GAMES_BY_DIMENSION[dim]) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      out.push(entry);
    }
  }
  return out;
}

const ALL_PORTAL_GAMES = allPortalGames();

const CATEGORY_META: Record<
  (typeof COGNITIVE_DIMENSION_KEYS)[number],
  { sticker: string; bgClass: string }
> = {
  memory: {
    sticker: "/brain-games/Memory.svg",
    bgClass: "from-[#59A8F0] to-[#0D5FA4]",
  },
  logic: {
    sticker: "/brain-games/Logic.svg",
    bgClass: "from-[#F0B16F] to-[#CB7A12]",
  },
  focus: {
    sticker: "/brain-games/Focus.svg",
    bgClass: "from-[#C37AF0] to-[#8B2BC4]",
  },
  reaction: {
    sticker: "/brain-games/Reaction.svg",
    bgClass: "from-[#8DDCD2] to-[#11A68F]",
  },
  strategy: {
    sticker: "/brain-games/Chess.svg",
    bgClass: "from-[#DFC267] to-[#B38813]",
  },
  spatial: {
    sticker: "/brain-games/Spatial.svg",
    bgClass: "from-[#E45B43] to-[#9F1508]",
  },
};

function launchForKey(
  entry: GameEntry,
  launchByKey: BrainGamesTabProps["launchByKey"]
): () => void {
  const launchKey = entry.launchKey;
  if (launchKey === "external") {
    const externalUrl = entry.externalUrl;
    if (!externalUrl) return () => {};
    return () => {
      void postGamePlayedRecord(entry.key).catch(() => {
        /* open game even if record fails */
      });
      window.location.href = externalUrl;
    };
  }
  return () => launchByKey(launchKey);
}

/**
 * Brain games tab with featured carousel and category explorer.
 */
export default function BrainGamesTab({ launchByKey }: BrainGamesTabProps) {
  const tHome = useTranslations("dashboard");
  const tBrain = useTranslations("brainGames");
  const [activeCategory, setActiveCategory] = useState<GameCategoryFilter>(null);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const { likeStates } = useGameLikes();
  /** New shuffle on browser refresh / remount — zeros slots follow this order among chessmater / quantumgo / fogchess. */
  const [ribbonZeroFillOrder] = useState(() => shuffleInPlace([...RIBBON_ZERO_FILL_KEYS]));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % FEATURED_GAMES.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const rankedTopKeys = useMemo(() => {
    const likeCount = (k: string) => likeStates.get(k)?.count ?? 0;
    return computeRibbonTopThree(likeCount, PORTAL_LIKEABLE_GAME_KEYS, ribbonZeroFillOrder);
  }, [likeStates, ribbonZeroFillOrder]);

  const selectedGames =
    activeCategory === null ? ALL_PORTAL_GAMES : (GAMES_BY_DIMENSION[activeCategory] ?? []);

  return (
    <div className="space-y-5 pb-8 font-app-body">
      <section className="flex flex-col gap-3 lg:flex-row lg:gap-4 lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-[1.89] flex-col gap-2">
          <div className="flex min-h-[32px] items-center justify-between gap-3">
            <h2 className="text-[22px] font-semibold leading-tight text-[#106FAA]">{tBrain("ribbon.newIn")}</h2>
            <div className="flex shrink-0 items-center gap-[6px]" role="tablist" aria-label="Featured games">
              {FEATURED_GAMES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === featuredIndex}
                  aria-label={`${i + 1} / ${FEATURED_GAMES.length}`}
                  onClick={() => setFeaturedIndex(i)}
                  className="inline-flex items-center justify-center px-2 py-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#106FAA]/40 focus-visible:ring-offset-2"
                >
                  <span
                    className={`block h-[9px] shrink-0 rounded-[20px] transition-[width,background-color] duration-300 ${
                      i === featuredIndex
                        ? "w-[49px] bg-[rgba(160,196,219,0.6)]"
                        : "w-[18px] bg-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.82)]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div
            className="relative min-h-[308px] flex-1 overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]"
            style={{ minHeight: FEATURE_ROW_MIN_H_PX }}
          >
            {FEATURED_GAMES.map((feature, idx) => {
              const imageSrc = GAME_COVER_MAP[feature.key];
              const isActive = idx === featuredIndex;
              const launchEntry = GAMES_BY_DIMENSION.strategy.find((entry) => entry.key === feature.key);
              return (
                <div
                  key={feature.key}
                  className={`absolute inset-0 flex h-full min-h-0 flex-col transition-opacity duration-700 sm:flex-row sm:items-stretch ${
                    isActive ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center bg-[#F6FAFE] p-5 sm:max-w-[min(56%,520px)] sm:flex-[1.15] sm:p-6 sm:pr-5">
                    <span className="inline-flex w-fit rounded-full bg-[#EDF4FC] px-4 py-1.5 text-[14px] font-semibold text-[#045E96]">
                      {tBrain("ribbon.strategyBadge")}
                    </span>
                    <h3 className="mt-2 font-['Titan_One'] text-[40px] leading-[1.1] text-[#045E96] sm:text-[48px] sm:leading-[60px]">
                      {feature.key === "fogchess" ? tHome("startFogChess") : tHome("quantumGo")}
                    </h3>
                    <p className="mt-3 max-w-[420px] text-[16px] leading-5 text-[#106FAA]">
                      {tBrain("ribbon.featuredIntro")}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {launchEntry ? (
                        <button
                          type="button"
                          onClick={launchForKey(launchEntry, launchByKey)}
                          className="h-[45px] min-w-[125px] rounded-full bg-[#045E96] px-6 text-[16px] font-semibold text-white shadow-[0px_3.2px_4.8px_rgba(4,94,150,0.3)]"
                        >
                          {tBrain("ribbon.playNow")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="h-[45px] min-w-[129px] rounded-full bg-[#DDEDFF] px-6 text-[16px] font-semibold text-[#045E96]"
                      >
                        {tBrain("ribbon.learnMore")}
                      </button>
                    </div>
                  </div>
                  <div className="relative min-h-[220px] w-full flex-1 overflow-hidden bg-slate-100 sm:min-h-0 sm:min-w-0 sm:flex-[0.95]">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={feature.key === "fogchess" ? tHome("startFogChess") : tHome("quantumGo")}
                        fill
                        className="object-cover object-center"
                        sizes="(max-width: 640px) 100vw, 42vw"
                        unoptimized
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 min-w-[260px] flex-1 flex-col gap-2 lg:max-w-none">
          <h2 className="text-[22px] font-semibold text-[#106FAA]">{tBrain("ribbon.topRanking")}</h2>
          <div
            className="flex min-h-0 flex-1 flex-col justify-evenly gap-2"
            style={{ minHeight: FEATURE_ROW_MIN_H_PX }}
          >
            {rankedTopKeys.map((gameKey, index) => {
              const rankingEntry = findBrainGameEntry(gameKey);
              const imageSrc = GAME_COVER_MAP[gameKey] ?? `/brain-games/${gameKey}.gif`;
              if (!rankingEntry) return null;

              return (
                <button
                  key={gameKey}
                  type="button"
                  onClick={launchForKey(rankingEntry, launchByKey)}
                  className="flex w-full shrink-0 items-center gap-3 rounded-[16px] border border-white/80 bg-white p-3 text-left shadow-[0px_10px_15px_0px_rgba(0,0,0,0.10)] transition hover:translate-y-[-1px]"
                >
                  <div className="relative h-8 w-8 shrink-0">
                    <Image
                      src={RANK_MEDAL_SRC[index]}
                      alt=""
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="relative h-[50px] w-[68px] shrink-0 overflow-hidden rounded-[10px] bg-slate-200">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={tHome(rankingEntry.nameKey)}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {tHome(rankingEntry.nameKey)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xl text-[#0B6FB4]">›</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative">
        <h2 className="relative z-20 pb-0 text-[22px] font-semibold leading-tight text-[#106FAA]">
          {tBrain("ribbon.gameCategories")}
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 pb-px pt-0 mt-[1cm] md:grid-cols-3 xl:grid-cols-6">
        {CATEGORY_ORDER.map((dimKey) => {
          const meta = CATEGORY_META[dimKey];
          const isActive = activeCategory === dimKey;
          return (
            <button
              key={dimKey}
              type="button"
              onClick={() =>
                setActiveCategory((prev) => (prev === dimKey ? null : dimKey))
              }
              className={`group relative w-full cursor-pointer overflow-visible text-left outline-none transition ${
                isActive ? "" : "hover:-translate-y-0.5"
              }`}
            >
              <div className="relative w-full">
                {/* 贴图层：absolute；负 top 只够叠在卡片圆角附近，不把实体插画伸到标题行 */}
                <div
                  className={`pointer-events-none absolute right-2 z-20 ml-auto flex w-[85%] items-end justify-end drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)] sm:w-[129px] ${
                    dimKey === "spatial"
                      ? "-top-[4.25rem] h-[138px] max-w-[140px]"
                      : "-top-[2.875rem] h-[124px] max-w-[129px]"
                  }`}
                >
                  {dimKey === "memory" ? (
                    <div className="relative h-[115px] w-full max-w-[129px]">
                      <Image
                        src={meta.sticker}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="120px"
                      />
                      <div className="absolute bottom-0 right-8 z-10 h-[101px] w-[90px] rotate-[8deg] -scale-x-100 opacity-90">
                        <Image
                          src={meta.sticker}
                          alt=""
                          fill
                          className="object-contain"
                          sizes="88px"
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative ${
                        dimKey === "logic"
                          ? "h-[109px] w-[109px]"
                          : dimKey === "spatial"
                            ? "h-[138px] w-[138px]"
                            : "h-[115px] w-[115px]"
                      }`}
                    >
                      <Image
                        src={meta.sticker}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="108px"
                      />
                    </div>
                  )}
                </div>

                <div
                  className={`relative z-10 flex min-h-[118px] flex-col justify-end rounded-[21.75px] border-[0.75px] border-white/60 bg-gradient-to-b px-4 pb-4 pt-11 text-white shadow-[0px_7.25px_10.877px_0px_rgba(0,0,0,0.1),0px_2.9px_4.351px_0px_rgba(0,0,0,0.1)] ${meta.bgClass} ${
                    isActive ? "ring-2 ring-sky-200 ring-offset-2 ring-offset-slate-100/80" : ""
                  }`}
                >
                  <h3 className="text-[16px] font-semibold leading-snug">
                    {tBrain(`categoryChip.${dimKey}` as "categoryChip.memory")}
                  </h3>
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold text-[#106FAA]">
          {activeCategory === null
            ? tBrain("categoryListing.all")
            : tBrain(`categoryListing.${activeCategory}` as "categoryListing.memory")}
        </h2>

        {selectedGames.length === 0 ? (
          <p className="rounded-2xl bg-[#EDF4FC] px-4 py-6 text-sm text-slate-500">
            {tBrain("categoryComingSoon")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {selectedGames.map((entry) => {
              const imageSrc = entry.skipCover
                ? null
                : (GAME_COVER_MAP[entry.key] ?? `/brain-games/${entry.key}.gif`); 
              const playerText =
                entry.key === "quantumgo" || entry.key === "no-king-chess" || entry.key === "soccer_chess" || entry.key === "fogchess" || entry.key === "online-chess" ? tBrain("playersOneTwo") : tBrain("playersOne");
              const launch = launchForKey(entry, launchByKey);

              return (
                <div
                  key={entry.key}
                  className="@container/card rounded-[22px] border border-white/60 bg-white/90 p-3 text-left shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition hover:translate-y-[-2px] sm:rounded-[26px] sm:p-3.5 md:rounded-[30px] md:p-4 lg:rounded-[32px] lg:p-[15px]"
                >
                  <button type="button" onClick={launch} className="block w-full text-left">
                    <div className="relative aspect-[344/217] w-full overflow-hidden rounded-[18px] bg-slate-200 sm:rounded-[20px] md:rounded-[22px] lg:rounded-[24px]">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={tHome(entry.nameKey)}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                  </button>
                  {/* Figma: left column = title + players (tight gap); Play vertically centered to that block */}
                  <div className="mt-3 px-0 @min-[22rem]/card:mt-4 sm:px-0.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-px">
                        <button type="button" onClick={launch} className="min-w-0 text-left">
                          <p className="m-0 break-words font-['Titan_One'] text-[15px] font-normal leading-tight text-[#045E96] @min-[18rem]/card:text-[17px] @min-[22rem]/card:text-[19px] @min-[26rem]/card:text-xl @min-[22rem]/card:leading-snug">
                            {tHome(entry.nameKey)}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={launch}
                          className="font-app-body flex min-w-0 items-center gap-2 py-0 text-left text-[12px] font-normal leading-snug text-[#106FAA] @min-[20rem]/card:text-sm @min-[20rem]/card:leading-5"
                        >
                          <span className="inline-flex h-4 w-4 shrink-0 text-[#106FAA]" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" stroke="currentColor" strokeWidth="1.6">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          </span>
                          <span>{playerText}</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          launch();
                        }}
                        className="font-app-body inline-flex h-8 min-w-[7rem] shrink-0 items-center justify-center rounded-full bg-[#DDEDFF] px-4 text-[13px] font-medium leading-5 text-[#045E96] @min-[22rem]/card:min-w-[7.25rem] @min-[22rem]/card:px-5 @min-[22rem]/card:text-sm"
                      >
                        {tBrain("ribbon.playNow")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
