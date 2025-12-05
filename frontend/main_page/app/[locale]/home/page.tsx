"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useGameLauncher } from "@/hooks/useGameLauncher";
import HomeContent from "@/components/home/HomeContent";

/**
 * 登录后的主页
 * page.tsx 应该保持简洁，只负责组装逻辑
 */
export default function HomePage() {
  const tCommon = useTranslations("common");
  const { username, loading, logout } = useAuth();
  const {
    handleFogChess,
    handleSudokuBattle,
    handleQuantumGo,
    handleChessMater,
    handleChessTourmaster,
  } = useGameLauncher();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-gray-600">{tCommon("loading")}</div>
      </div>
    );
  }

  return (
    <HomeContent
      username={username}
      onFogChess={handleFogChess}
      onSudokuBattle={handleSudokuBattle}
      onQuantumGo={handleQuantumGo}
      onChessMater={handleChessMater}
      onChessTourmaster={handleChessTourmaster}
      onLogout={logout}
    />
  );
}

