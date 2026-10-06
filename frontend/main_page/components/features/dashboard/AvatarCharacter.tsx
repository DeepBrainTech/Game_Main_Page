"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { getHomeSystemBaseAsset, HOME_SYSTEM_ARTBOARD } from "@/config/homeSystem";

export interface AvatarConfig {
  headAsset?: string;
  bodyAsset?: string;
  handAsset?: string;
  limitedAsset?: string;
}

interface AvatarCharacterProps {
  config: AvatarConfig;
  onClick?: () => void;
  direction?: "left" | "right";
  className?: string;
  interactive?: boolean;
  previewFrame?: { canvas: { width: number; height: number }; bounds: readonly [number, number, number, number] };
}

export default function AvatarCharacter({ config, onClick, direction = "right", className, interactive = true, previewFrame }: AvatarCharacterProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const avatarImageSrc = config.limitedAsset ?? getHomeSystemBaseAsset();
  const imageStyle = {
    transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
    transformOrigin: "center center",
  };

  const handleClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onClick?.();
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div
      className={`relative ${className ?? "h-[clamp(10rem,24vw,16rem)] w-[clamp(10rem,24vw,16rem)]"} ${interactive ? "cursor-pointer" : "pointer-events-none"} transition-transform duration-300 ${
        isAnimating ? "animate-bounce-custom" : ""
      }`}
      onClick={interactive ? handleClick : undefined}
    >
      {previewFrame ? (
        <svg className="pointer-events-none h-full w-full" viewBox={previewFrame.bounds.join(" ")} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {[avatarImageSrc, ...(!config.limitedAsset ? [config.bodyAsset, config.handAsset, config.headAsset] : [])].filter(Boolean).map((asset, index) => (
            <image key={`${index}-${asset}`} href={asset} width={previewFrame.canvas.width} height={previewFrame.canvas.height} />
          ))}
        </svg>
      ) : <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="relative w-full overflow-hidden"
          style={{
            ...imageStyle,
            aspectRatio: `${HOME_SYSTEM_ARTBOARD.width} / ${HOME_SYSTEM_ARTBOARD.height}`,
          }}
        >
          <img
            src={avatarImageSrc}
            alt="home character"
            draggable={false}
            className="absolute left-0 top-0 z-10 block w-full max-w-none select-none drop-shadow-xl"
            style={{ height: "auto" }}
          />

          {!config.limitedAsset && config.bodyAsset && (
            <img
              src={config.bodyAsset}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 z-20 h-auto w-full max-w-none select-none"
            />
          )}

          {!config.limitedAsset && config.handAsset && (
            <img
              src={config.handAsset}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 z-30 h-auto w-full max-w-none select-none"
            />
          )}

          {!config.limitedAsset && config.headAsset && (
            <img
              src={config.headAsset}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 z-40 h-auto w-full max-w-none select-none"
            />
          )}
        </div>
      </div>}

      {isAnimating && (
        <div
          className="pointer-events-none absolute z-40 whitespace-nowrap rounded-xl border border-gray-100 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-md animate-fade-in-up"
          style={{
            left: "66%",
            top: "16%",
            transform: "translate(0, -50%)",
          }}
        >
          {"\uD83D\uDC35 Ooh!"}
        </div>
      )}
    </div>
  );
}
