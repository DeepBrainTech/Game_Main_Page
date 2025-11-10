"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getApiUrl } from "@/lib/api-config";
// 着陆页组件
import HeroSection from "@/components/landing/HeroSection";
import GameCard from "@/components/landing/GameCard";
import BenefitCard from "@/components/landing/BenefitCard";
import TestimonialCard from "@/components/landing/TestimonialCard";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const tBeforeLogin = useTranslations("beforelogin");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  // 游戏数据配置
  const games = [
    {
      key: "cognigo",
      image: "/images/game-cognigo.jpg",
      color: "from-blue-500 to-blue-600",
      buttonColor: "bg-blue-500",
      linkUrl: `/${locale}/login`,
    },
    {
      key: "fogOfWar",
      image: "/images/game-fog-of-war.jpg",
      color: "from-orange-500 to-orange-600",
      buttonColor: "bg-orange-500",
      linkUrl: `/${locale}/login`,
    },
    {
      key: "sudoku",
      image: "/images/game-sudoku.jpg",
      color: "from-purple-500 to-purple-600",
      buttonColor: "bg-purple-500",
      linkUrl: `/${locale}/login`,
    },
    {
      key: "sudokuBattle",
      image: "/images/game-sudoku.jpg",
      color: "from-yellow-500 to-yellow-600",
      buttonColor: "bg-yellow-500",
      linkUrl: `/${locale}/login`,
    },
    {
      key: "chess",
      image: "/images/game-chess.jpg",
      color: "from-blue-500 to-blue-700",
      buttonColor: "bg-blue-600",
      linkUrl: `/${locale}/login`,
    },
    {
      key: "more",
      image: "/images/game-more.jpg",
      color: "from-gray-500 to-gray-600",
      buttonColor: "bg-gray-500",
      linkUrl: `/${locale}/login`,
    },
  ];

  // 核心能力数据配置
  const benefits = [
    { key: "strategicThinking", icon: "🧠", color: "bg-blue-100 text-blue-600" },
    { key: "adaptability", icon: "🔄", color: "bg-orange-100 text-orange-600" },
    { key: "focus", icon: "🎯", color: "bg-green-100 text-green-600" },
    { key: "memory", icon: "🧩", color: "bg-yellow-100 text-yellow-600" },
    { key: "patternRecognition", icon: "🔍", color: "bg-indigo-100 text-indigo-600" },
  ];

  // 用户评价数据配置
  const testimonials = [
    { key: "testimonial1" },
    { key: "testimonial2" },
    { key: "testimonial3" },
  ];

  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem("access_token");
    if (token) {
      // 验证 token 是否有效
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
          setIsLoggedIn(true);
          setUsername(data.data?.username || "");
        })
        .catch(() => {
          localStorage.removeItem("access_token");
          setIsLoggedIn(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_expires_in");
    setIsLoggedIn(false);
    setUsername("");
  };

  const handleSudokuBattle = () => {
    const token = localStorage.getItem("access_token");
    const baseUrl = "https://sudoku-battle.deepbraintechnology.com/";
    let url = baseUrl;
    if (token) {
      // 使用 URL fragment 传递，避免出现在 Referer 中
      url = `${baseUrl}#token=${encodeURIComponent(token)}&locale=${encodeURIComponent(locale)}`;
    }
    // 在新标签页中打开
    window.open(url, "_blank");
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-gray-600">{tCommon("loading")}</div>
      </div>
    );
  }

  // 如果已登录，显示原来的主页
  if (isLoggedIn) {
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

  // 如果未登录，显示着陆页
  return (
    <div className="min-h-screen bg-[#FEF6EC] font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">🧠 DeepBrainTech Presents</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero Section - 使用组件 */}
      <HeroSection 
        onWatchDemo={() => {
          // TODO: 实现视频播放功能
          console.log("Watch demo clicked");
        }}
      />

      {/* Games Section - 使用 GameCard 组件 */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-800">
            {tBeforeLogin("games.title")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <GameCard
                key={game.key}
                gameKey={game.key}
                color={game.color}
                image={game.image}
                buttonColor={game.buttonColor}
                linkUrl={game.linkUrl}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section - 使用 BenefitCard 组件 */}
      <section className="py-16 px-6 bg-[#f5f1e8]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">
            {tBeforeLogin("benefits.title")}
          </h2>
          <p className="text-center text-gray-800 mb-12 max-w-3xl mx-auto">
            {tBeforeLogin("benefits.subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {benefits.map((benefit) => (
              <BenefitCard
                key={benefit.key}
                benefitKey={benefit.key}
                icon={benefit.icon}
                color={benefit.color}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section - 使用 TestimonialCard 组件 */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">
            {tBeforeLogin("testimonials.title")}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {tBeforeLogin("testimonials.subtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.key}
                testimonialKey={testimonial.key}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - 使用 CTASection 组件 */}
      <CTASection
        onSignUp={() => router.push(`/${locale}/register`)}
        onLogin={() => router.push(`/${locale}/login`)}
      />

      {/* Footer - 使用 LandingFooter 组件 */}
      <LandingFooter />
    </div>
  );
}
