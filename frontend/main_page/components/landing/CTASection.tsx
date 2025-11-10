"use client";

import { useTranslations } from "next-intl";

interface CTASectionProps {
  onSignUp: () => void;
  onLogin: () => void;
}

/**
 * 行动号召区域组件
 * 包含吸引用户注册/登录的大型号召按钮
 */
export default function CTASection({ onSignUp, onLogin }: CTASectionProps) {
  const t = useTranslations("beforelogin.cta");

  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t("title")}
            </h2>
            <p className="text-white/90 text-lg mb-8">
              {t("subtitle")}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={onSignUp}
                className="px-8 py-3 bg-white text-blue-600 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-lg"
              >
                {t("signUpNow")}
              </button>
              <button
                onClick={onLogin}
                className="px-8 py-3 bg-transparent border-2 border-white text-white rounded-full font-bold hover:bg-white/10 transition-colors"
              >
                {t("logIn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

