"use client";

import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getApiUrl } from "@/lib/api-config";

/**
 * 游戏启动配置类型
 */
interface GameConfig {
  gameKey: string;
  apiEndpoint: string;
  gameUrl?: string;
  envVar?: string;
  openInNewTab?: boolean;
}

/**
 * 游戏启动相关的 Hook
 * 统一处理所有游戏的启动逻辑
 */
export function useGameLauncher() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const tHome = useTranslations("home");

  /**
   * 启动游戏的通用函数
   */
  const launchGame = async (config: GameConfig) => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      router.push(`/${locale}/login`);
      return;
    }

    try {
      // 获取游戏令牌
      const response = await fetch(getApiUrl(config.apiEndpoint), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("获取游戏令牌失败");
      }

      const data = await response.json();
      const gameToken = data?.data?.game_token;
      if (!gameToken) {
        throw new Error("无效的游戏令牌响应");
      }

      // 确定游戏 URL
      let gameUrl = config.gameUrl;
      if (config.envVar) {
        gameUrl = process.env[config.envVar] || gameUrl;
      }
      
      if (!gameUrl) {
        throw new Error(`未配置游戏 URL (${config.gameKey})`);
      }

      // 构建完整 URL
      const url = `${gameUrl}#token=${encodeURIComponent(gameToken)}&locale=${encodeURIComponent(locale)}`;

      // 打开游戏
      if (config.openInNewTab) {
        window.open(url, "_blank");
      } else {
        window.location.href = url;
      }
    } catch (error) {
      console.error(error);
      alert(tHome("failedToStartGame"));
    }
  };

  // 各个游戏的启动函数
  const handleFogChess = () => {
    launchGame({
      gameKey: "fogchess",
      apiEndpoint: "/api/games/fogchess/token",
      gameUrl: "https://fogchess-frontend.onrender.com", // 默认开发环境 URL
      envVar: "NEXT_PUBLIC_FOGCHESS_URL", // 环境变量优先，如果没有设置则使用默认值
      openInNewTab: false,
    });
  };

  const handleSudokuBattle = () => {
    launchGame({
      gameKey: "sudokuBattle",
      apiEndpoint: "/api/games/sudoku/token",
      gameUrl: "https://sudoku-battle.deepbraintechnology.com/",
      openInNewTab: true,
    });
  };

  const handleQuantumGo = () => {
    launchGame({
      gameKey: "quantumGo",
      apiEndpoint: "/api/games/quantumgo/token",
      gameUrl: "https://quantumgo.deepbraintechnology.com/",
      envVar: "NEXT_PUBLIC_QUANTUMGO_URL",
      openInNewTab: false,
    });
  };

  const handleChessMater = () => {
    launchGame({
      gameKey: "chessMater",
      apiEndpoint: "/api/games/chessmater/token",
      gameUrl: "https://chessmater.pages.dev/",
      openInNewTab: true,
    });
  };

  const handleChessTourmaster = () => {
    launchGame({
      gameKey: "chessTourmaster",
      apiEndpoint: "/api/games/chess-tourmaster/token",
      gameUrl: "https://chess-tourmaster.pages.dev/",
      openInNewTab: true,
    });
  };

  const handleSudoku = () => {
    // 直接打开链接，不需要 token
    window.open("https://sudoku.deepbraintechnology.com/", "_blank");
  };

  return {
    handleFogChess,
    handleSudokuBattle,
    handleSudoku,
    handleQuantumGo,
    handleChessMater,
    handleChessTourmaster,
  };
}

