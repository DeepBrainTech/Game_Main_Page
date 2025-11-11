"use client";

import { useTranslations } from "next-intl";

interface HeroSectionProps {
  onWatchDemo?: () => void;
}

/**
 * 着陆页英雄区域组件
 * 包含主标题、副标题、描述和视频演示区域
 */
export default function HeroSection({ onWatchDemo }: HeroSectionProps) {
  const t = useTranslations("beforelogin.hero");

  return (
    <section className="pt-32 pb-16 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold:200 mb-2">
          <span className="text-[#0A0A0A] block mb-2">{t("title")}</span>
          <span className="text-[#5E81AC] block">{t("subtitle")}</span>
        </h1>
        <br />
        <p className="text-lg text-[#000000] mb-8 max-w-2xl mx-auto">
          {t("description")}
        </p>
        <button 
          onClick={() => {
            if (onWatchDemo) {
              onWatchDemo();
            }
            // 滚动到视频区域
            document.getElementById("demo-video")?.scrollIntoView({ 
              behavior: "smooth",
              block: "center"
            });
          }}
          className="px-6 py-3 bg-[#A3BE8C] hover:bg-[#8FA87A] text-white rounded-full font-medium transition-colors shadow-md inline-flex items-center gap-2 mx-auto"
        >
          {/* 播放图标 */}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <path 
              d="M3 2L13 8L3 14V2Z" 
              stroke="white" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          {t("watchDemo")}
        </button>
      </div>
      

      {/* Video/Demo Section */}
      <div id="demo-video" className="max-w-4xl mx-auto mt-12">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gray-800 aspect-video">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/DuboYb_n-xE?loop=1&playlist=DuboYb_n-xE"
            title="Demo Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </section>
  );
}

