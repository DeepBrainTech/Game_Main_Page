"use client";

import { useTranslations } from "next-intl";

interface GameCardProps {
  gameKey: string;
  color: string;
  image?: string;
  buttonColor?: string; // 按钮颜色（Tailwind 类名，如 "bg-blue-500"）
  linkUrl?: string; // 链接地址
}

/**
 * 游戏卡片组件
 * 用于展示单个游戏的信息，包括图片、名称、标语和描述
 */
export default function GameCard({ 
  gameKey, 
  color, 
  image,
  buttonColor = "bg-blue-500",
  linkUrl = "#"
}: GameCardProps) {
  const t = useTranslations("beforelogin.games");

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow flex flex-col">
      {/* 游戏图片/背景区域 */}
      <div className={`h-48 bg-gradient-to-br ${color} relative flex-shrink-0`}>
        {image && (
          <img 
            src={image} 
            alt={t(`${gameKey}.name`)}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>
      
      {/* 游戏信息区域 - 使用 flex-grow 让内容区域扩展 */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold mb-2 text-gray-800">
          {t(`${gameKey}.name`)}
        </h3>
        <p className="text-sm text-blue-600 font-medium mb-2">
          {t(`${gameKey}.tagline`)}
        </p>
        <p className="text-sm text-gray-600 mb-4 flex-grow">
          {t(`${gameKey}.description`)}
        </p>
        {/* Learn More 按钮 - 全宽，在底部，使用传入的颜色 */}
        <a 
          href={linkUrl}
          className={`w-full py-3 ${buttonColor} hover:opacity-90 text-white rounded-lg font-medium text-center transition-all shadow-md hover:shadow-lg`}
        >
          Learn More
        </a>
      </div>
    </div>
  );
}

