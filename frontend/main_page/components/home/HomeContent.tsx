"use client";

import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface HomeContentProps {
  username: string;
  onFogChess: () => void;
  onSudokuBattle: () => void;
  onSudoku: () => void;
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
  onSudoku,
  onQuantumGo,
  onChessMater,
  onChessTourmaster,
  onLogout,
}: HomeContentProps) {
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");

  // 游戏配置，包含颜色和图标
  const games = [
    {
      key: "fogChess",
      name: tHome("startFogChess"),
      onClick: onFogChess,
      color: "bg-[#D08770]",
      hoverColor: "hover:bg-[#C07760]",
    },
    {
      key: "sudoku",
      name: tHome("sudoku"),
      onClick: onSudoku,
      color: "bg-[#EEC643]",
      hoverColor: "hover:bg-[#DEB633]",
    },
    // {
    //   key: "sudokuBattle",
    //   name: tHome("sudokuBattle"),
    //   onClick: onSudokuBattle,
    //   color: "bg-[#EEC643]",
    //   hoverColor: "hover:bg-[#DEB633]",
    // },
    {
      key: "quantumGo",
      name: tHome("quantumGo"),
      onClick: onQuantumGo,
      color: "bg-[#5E81AC]",
      hoverColor: "hover:bg-[#4E719C]",
    },
    {
      key: "chessMater",
      name: tHome("chessMater"),
      onClick: onChessMater,
      color: "bg-[#5E81AC]",
      hoverColor: "hover:bg-[#4E719C]",
    },
    {
      key: "chessTourmaster",
      name: tHome("chessTourmaster"),
      onClick: onChessTourmaster,
      color: "bg-[#A3BE8C]",
      hoverColor: "hover:bg-[#93AE7C]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FEF6EC] font-sans">
      {/* Header - 与首页保持一致 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">🧠 DeepBrainTech Presents</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          {/* 欢迎区域 */}
          <div className="text-center mb-12">
            <h2 
              className="text-4xl md:text-5xl font-bold text-[#2C3539] mb-4"
              style={{ textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)' }}
            >
              {tHome("welcomeUser", { username })}
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              {tHome("subtitle")}
            </p>
          </div>

          {/* 游戏按钮网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {games.map((game) => (
              <button
                key={game.key}
                onClick={game.onClick}
                className={`${game.color} ${game.hoverColor} text-white rounded-2xl px-6 py-8 text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center min-h-[120px]`}
              >
                {game.name}
              </button>
            ))}
          </div>

          {/* 退出登录按钮 */}
          <div className="flex justify-center mt-8">
            <button
              onClick={onLogout}
              className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-full font-medium transition-all duration-300 hover:bg-gray-50 hover:border-gray-400 shadow-md hover:shadow-lg"
            >
              {tCommon("logout")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

