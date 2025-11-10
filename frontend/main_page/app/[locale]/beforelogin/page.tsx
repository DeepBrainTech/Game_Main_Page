"use client";

import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
// 导入着陆页组件
import {
  HeroSection,
  GameCard,
  BenefitCard,
  TestimonialCard,
  CTASection,
  LandingFooter,
} from "@/components/landing";

/**
 * BeforeLogin 独立页面
 * 用于直接访问 /[locale]/beforelogin 路径
 * 使用与主页面相同的组件，保持代码一致性
 */
export default function BeforeLoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations("beforelogin");

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
    { key: "focus", icon: "⚡", color: "bg-green-100 text-green-600" },
    { key: "memory", icon: "💡", color: "bg-yellow-100 text-yellow-600" },
    { key: "patternRecognition", icon: "📊", color: "bg-indigo-100 text-indigo-600" },
  ];

  // 用户评价数据配置
  const testimonials = [
    { key: "testimonial1" },
    { key: "testimonial2" },
    { key: "testimonial3" },
  ];

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
            {t("games.title")}
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
            {t("benefits.title")}
          </h2>
          <p className="text-center text-gray-800 mb-12 max-w-3xl mx-auto">
            {t("benefits.subtitle")}
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
            {t("testimonials.title")}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {t("testimonials.subtitle")}
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

