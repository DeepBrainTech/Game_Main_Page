"use client";

import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface HomeContentProps {
  username: string;
  onFogChess: () => void;
  onSudokuBattle: () => void;
  onQuantumGo: () => void;
  onChessMater: () => void;
  onChessTourmaster: () => void;
  onLogout: () => void;
}

/**
 * 主页内容组件
 * 负责渲染主页的 UI
 */
export default function HomeContent({
  username,
  onFogChess,
  onSudokuBattle,
  onQuantumGo,
  onChessMater,
  onChessTourmaster,
  onLogout,
}: HomeContentProps) {
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start relative">
        {/* 语言切换器 */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-5xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50">
            {tHome("title")}
          </h1>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <div className="flex flex-col items-center gap-4 sm:items-start">
            <p className="text-black dark:text-white">
              {tHome("welcomeUser", { username })}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <button
                onClick={onFogChess}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("startFogChess")}
              </button>
              <button
                onClick={onSudokuBattle}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("sudokuBattle")}
              </button>
              <button
                onClick={onQuantumGo}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("quantumGo")}
              </button>
              <button
                onClick={onChessMater}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("chessMater")}
              </button>
              <button
                onClick={onChessTourmaster}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("chessTourmaster")}
              </button>
              <button
                onClick={onLogout}
                className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.08] px-8 text-black transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-white dark:hover:bg-[#1a1a1a]"
              >
                {tCommon("logout")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

