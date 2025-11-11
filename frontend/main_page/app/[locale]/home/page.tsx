"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getApiUrl } from "@/lib/api-config";

/**
 * 登录后的主页
 * 显示欢迎信息和 SudokuBattle 游戏入口
 */
export default function HomePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 简单检查 token 是否存在
    const token = localStorage.getItem("access_token");
    if (!token) {
      // 未登录，重定向到语言选择页面
      router.push(`/`);
      return;
    }

    // 验证 token 是否有效并获取用户信息
    fetch(getApiUrl("/api/auth/verify"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error("Token 无效");
      })
      .then((data) => {
        setUsername(data.data?.username || "");
        setLoading(false);
      })
      .catch(() => {
        // Token 无效，清除并重定向到语言选择页面
        localStorage.removeItem("access_token");
        localStorage.removeItem("token_expires_in");
        router.push(`/`);
      });
  }, [locale, router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_expires_in");
    router.push(`/`);
  };

  const handleFogChess = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      router.push(`/${locale}/login`);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/games/fogchess/token"), {
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

      const fogChessUrl = process.env.NEXT_PUBLIC_FOGCHESS_URL;
      if (!fogChessUrl) {
        throw new Error("未配置 NEXT_PUBLIC_FOGCHESS_URL");
      }

      window.location.href = `${fogChessUrl}#token=${encodeURIComponent(gameToken)}`;
    } catch (error) {
      console.error(error);
      alert(tHome("failedToStartGame"));
    }
  };

  const handleSudokuBattle = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      router.push(`/${locale}/login`);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/games/sudoku/token"), {
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

      const baseUrl = "https://sudoku-battle.deepbraintechnology.com/";
      const url = `${baseUrl}#token=${encodeURIComponent(gameToken)}&locale=${encodeURIComponent(locale)}`;
      
      // 在新标签页中打开
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert(tHome("failedToStartGame"));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-gray-600">{tCommon("loading")}</div>
      </div>
    );
  }

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
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleFogChess}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("startFogChess")}
              </button>
              <button
                onClick={handleSudokuBattle}
                className="flex h-12 items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc]"
              >
                {tHome("sudokuBattle")}
              </button>
              <button
                onClick={handleLogout}
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

