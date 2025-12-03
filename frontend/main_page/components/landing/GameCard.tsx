"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

interface GameCardProps {
  gameKey: string;
  image?: string;
  hoverImage?: string;
  buttonColor?: string; // 按钮颜色（Tailwind 类名，如 "bg-blue-500"）
  titleColor?: string; // 标题颜色（Tailwind 类名，如 "text-gray-800"）
  taglineColor?: string; // 标语颜色（Tailwind 类名，如 "text-blue-600"）
  descriptionColor?: string; // 描述颜色（Tailwind 类名，如 "text-gray-600"）
  linkUrl?: string; // 链接地址
}

/**
 * 游戏卡片组件
 * 用于展示单个游戏的信息，包括图片、名称、标语和描述
 */
export default function GameCard({ 
  gameKey,
  image,
  hoverImage,
  buttonColor = "bg-blue-500",
  titleColor = "text-gray-800",
  taglineColor = "text-blue-600",
  descriptionColor = "text-gray-600",
  linkUrl = "#"
}: GameCardProps) {
  const t = useTranslations("beforelogin.games");
  const [imagePath, setImagePath] = useState<string>('');
  const [hoverImagePath, setHoverImagePath] = useState<string>('');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  
  const resolveImagePath = (img?: string) => {
    if (!img) return '';
    if (img.startsWith('http')) {
      return img;
    }
    const path = img.startsWith('/') ? img : `/${img}`;
    if (typeof window === 'undefined') {
      return path;
    }
    return `${window.location.origin}${path}`;
  };

  // 在客户端设置图片路径，确保使用完整的 URL
  useEffect(() => {
    setImagePath(resolveImagePath(image));
    setHoverImagePath(resolveImagePath(hoverImage));
  }, [image, hoverImage]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <div
      className="bg-white overflow-hidden shadow-lg transition-all duration-300 flex flex-col w-full rounded-2xl hover:shadow-xl hover:-translate-y-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 游戏图片/背景区域 */}
      <div className="h-48 bg-gray-200 relative flex-shrink-0 overflow-hidden">
        {imagePath && (
          <img 
            src={imagePath} 
            alt={t(`${gameKey}.name`)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${isHovered && hoverImagePath ? 'opacity-0' : 'opacity-100'}`}
            onError={(e) => {
              console.error(`Failed to load image: ${imagePath}`);
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        {hoverImagePath && (
          <img
            src={hoverImagePath}
            alt={t(`${gameKey}.name`)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            onError={(e) => {
              console.error(`Failed to load hover image: ${hoverImagePath}`);
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>
      
      {/* 游戏信息区域 - 使用 flex-grow 让内容区域扩展 */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className={`text-xl font-bold mb-2 ${titleColor}`}>
          {t(`${gameKey}.name`)}
        </h3>
        <p className={`text-sm ${taglineColor} font-medium mb-2`}>
          {t(`${gameKey}.tagline`)}
        </p>
        <p className={`text-sm ${descriptionColor} mb-4 flex-grow`}>
          {t(`${gameKey}.description`)}
        </p>
        {/* Learn More 按钮 - 全宽，在底部，使用传入的颜色 */}
        <a 
          href={linkUrl}
          className={`w-full py-2 px-6 ${buttonColor} hover:opacity-90 text-white rounded-full font-medium text-center transition-all shadow-md hover:shadow-lg`}
        >
          Learn More
        </a>
      </div>
    </div>
  );
}
