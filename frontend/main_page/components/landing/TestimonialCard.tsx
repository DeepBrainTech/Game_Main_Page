"use client";

import { useTranslations } from "next-intl";

interface TestimonialCardProps {
  testimonialKey: string;
}

/**
 * 用户评价卡片组件
 * 展示用户对产品的评价，包括评价内容、作者和职位
 */
export default function TestimonialCard({ testimonialKey }: TestimonialCardProps) {
  const t = useTranslations("beforelogin.testimonials");

  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg">
      <div className="text-4xl text-gray-300 mb-4">&ldquo;</div>
      <p className="text-gray-700 mb-6">
        {t(`${testimonialKey}.text`)}
      </p>
      <div className="border-t pt-4">
        <p className="font-bold text-gray-800">
          {t(`${testimonialKey}.author`)}
        </p>
        <p className="text-sm text-gray-500">
          {t(`${testimonialKey}.position`)}
        </p>
      </div>
    </div>
  );
}

