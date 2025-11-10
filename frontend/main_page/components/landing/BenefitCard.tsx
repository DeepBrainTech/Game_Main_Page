"use client";

import { useTranslations } from "next-intl";

interface BenefitCardProps {
  benefitKey: string;
  icon: string;
  color: string;
}

/**
 * 核心能力卡片组件
 * 用于展示认知技能及对应的游戏
 * 设计：白色卡片背景，圆角，阴影，圆形图标
 */
export default function BenefitCard({ 
  benefitKey, 
  icon, 
  color 
}: BenefitCardProps) {
  const t = useTranslations("beforelogin.benefits");

  return (
    <div className="bg-white rounded-3xl p-6 shadow-md text-center">
      {/* 圆形图标背景 */}
      <div className={`w-16 h-16 ${color} rounded-full flex items-center justify-center mx-auto mb-4 text-3xl`}>
        {icon}
      </div>
      {/* 技能名称 - 粗体、深色 */}
      <h3 className="font-bold text-gray-800 mb-2">
        {t(`${benefitKey}.title`)}
      </h3>
      {/* 游戏名称 - 常规字重、深色、较小 */}
      <p className="text-sm text-gray-800">
        {t(`${benefitKey}.game`)}
      </p>
    </div>
  );
}

