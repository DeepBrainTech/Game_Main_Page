"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import AvatarCharacter, { type AvatarConfig } from "./AvatarCharacter";
import HomesteadCustomizePanel from "./HomesteadCustomizePanel";
import WukooChatPrompt from "./WukooChatPrompt";
import WukooConversationPanel from "./WukooConversationPanel";
import WukooMessageBubble from "./WukooMessageBubble";
import { sendMonkeyChatMessage, type MonkeyChatMessage } from "@/services/monkeyChatApi";
import { HOME_SYSTEM_DEFAULT_BACKGROUND_ID, getHomeSystemVisual } from "@/config/homeSystem";
import { useHomeSystem } from "@/hooks/useHomeSystem";
import type { HomeSystemSlot } from "@/types/homeSystem";

interface HomesteadBlockProps {
  userAvatarUrl?: string | null;
  activeCustomizeTab: HomeSystemSlot | null;
  menuOpen: boolean;
  coins: number;
  diamonds: number;
  onMenuOpenChange?: (isOpen: boolean) => void;
  onCustomizeTabChange?: (slot: HomeSystemSlot) => void;
}

export type SceneType = "island";

/** 平滑插值 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getBubblePlacement(position: { x: number; y: number }) {
  const safeLeft = "0.75rem";
  const rightOffset = `calc(100% - ${position.x}% + 4rem)`;

  return {
    right: rightOffset,
    width: `clamp(13rem, calc(${position.x}% - 4rem - ${safeLeft}), 20rem)`,
    top: `clamp(0.75rem, calc(${position.y}% - 12.5rem), calc(100% - 7rem))`,
    transform: "none",
  };
}

/**
 * 家园主场景：保持原样展示，配置面板从容器下方展开
 */
export default function HomesteadBlock({
  userAvatarUrl = null,
  activeCustomizeTab,
  menuOpen,
  coins,
  diamonds,
  onMenuOpenChange,
  onCustomizeTabChange,
}: HomesteadBlockProps) {
  const tHome = useTranslations("dashboard");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    items,
    ownedItemIds,
    loadout,
    loading: homeSystemLoading,
    busyItemId,
    error: homeSystemError,
    redeem,
    equip,
  } = useHomeSystem();
  const selectedHead = getHomeSystemVisual(loadout.head);
  const selectedBody = getHomeSystemVisual(loadout.body);
  const selectedHand = getHomeSystemVisual(loadout.hand);
  const selectedBackground = getHomeSystemVisual(loadout.background || HOME_SYSTEM_DEFAULT_BACKGROUND_ID);
  const selectedLimited = getHomeSystemVisual(loadout.limited);
  const avatarConfig: AvatarConfig = {
    headAsset: selectedHead?.primary,
    bodyAsset: selectedBody?.primary,
    handAsset: selectedHand?.primary,
    limitedAsset: selectedLimited?.primary,
  };
  const scene: SceneType = "island";
  const HOME_POSITION = { x: 50, y: 78 };
  const BOUNDS = { xMin: 20, xMax: 80, yMin: 20, yMax: 84 };

  const [position, setPosition] = useState(HOME_POSITION);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isWalking, setIsWalking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessage, setChatMessage] = useState(tHome("wukooMessage"));
  const [chatHistory, setChatHistory] = useState<MonkeyChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [shouldAnimateLatestAssistant, setShouldAnimateLatestAssistant] = useState(false);

  const targetRef = useRef(HOME_POSITION);
  const positionRef = useRef(HOME_POSITION);
  const returnCenterTimerRef = useRef<number | null>(null);

  const displayedChatMessages: MonkeyChatMessage[] = [
    { role: "assistant", content: tHome("wukooMessage") },
    ...chatHistory,
  ];
  const lastDisplayedMessage = displayedChatMessages[displayedChatMessages.length - 1];
  if (chatMessage && (!lastDisplayedMessage || lastDisplayedMessage.content !== chatMessage)) {
    displayedChatMessages.push({ role: "assistant", content: chatMessage });
  }
  const bubblePlacement = getBubblePlacement(position);

  const handleChatSubmit = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;

    const nextHistory: MonkeyChatMessage[] = [...chatHistory, { role: "user" as const, content: message }].slice(-8);
    setChatInput("");
    setChatMessage(tHome("wukooThinking"));
    setChatHistory(nextHistory);
    setIsChatLoading(true);
    setShouldAnimateLatestAssistant(false);

    try {
      const result = await sendMonkeyChatMessage({
        message,
        locale: locale.startsWith("zh") ? "zh" : "en",
        history: chatHistory.slice(-8),
      });
      setChatMessage(result.answer);
      setChatHistory([...nextHistory, { role: "assistant" as const, content: result.answer }].slice(-8));
      setShouldAnimateLatestAssistant(true);
    } catch {
      const fallback = tHome("wukooError");
      setChatMessage(fallback);
      setChatHistory([...nextHistory, { role: "assistant" as const, content: fallback }].slice(-8));
      setShouldAnimateLatestAssistant(true);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCloseChatPanel = () => {
    setIsChatPanelOpen(false);
    setChatMessage(tHome("wukooMessage"));
    setShouldAnimateLatestAssistant(false);
  };

  // 点击场景移动角色
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-chat-control="true"]')) return;

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    targetRef.current = {
      x: Math.max(BOUNDS.xMin, Math.min(BOUNDS.xMax, x)),
      y: Math.max(BOUNDS.yMin, Math.min(BOUNDS.yMax, y)),
    };
    if (returnCenterTimerRef.current) {
      window.clearTimeout(returnCenterTimerRef.current);
      returnCenterTimerRef.current = null;
    }
    returnCenterTimerRef.current = window.setTimeout(() => {
      returnCenterTimerRef.current = null;
      targetRef.current = HOME_POSITION;
    }, 2000);
  };

  useEffect(() => {
    const WALK_THRESHOLD = 1.2;
    let rafId: number;

    const tick = () => {
      const target = targetRef.current;
      const pos = positionRef.current;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let t: number;
      if (distance > 25) t = 0.035;
      else if (distance > 12) t = 0.025;
      else if (distance > 4) t = 0.018;
      else if (distance > 1.5) t = 0.01;
      else t = 0.005;

      const newX = lerp(pos.x, target.x, t);
      const newY = lerp(pos.y, target.y, t);
      positionRef.current = { x: newX, y: newY };

      setPosition({ x: newX, y: newY });
      setDirection(target.x >= pos.x ? "right" : "left");
      setIsWalking(distance > WALK_THRESHOLD);

      rafId = requestAnimationFrame(tick);
    };

    targetRef.current = HOME_POSITION;
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (returnCenterTimerRef.current) window.clearTimeout(returnCenterTimerRef.current);
    };
  }, []);

  return (
    <div className="relative flex min-h-[clamp(19rem,40svh,27.5rem)] flex-col select-none md:min-h-[clamp(21rem,44svh,27.5rem)]">
      <div className="relative aspect-[1000/478] min-h-[clamp(19rem,40svh,27.5rem)] overflow-hidden rounded-3xl border border-amber-100/50 shadow-sm md:min-h-[clamp(21rem,44svh,27.5rem)]">
        <div className="absolute inset-0 z-0">
          {selectedBackground?.primary ? (
            <img
              src={selectedBackground.primary}
              alt=""
              draggable={false}
              className="h-full w-full select-none object-cover"
            />
          ) : scene === "island" ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-[#87CEEB] via-[#98D8F0] to-[#5BA3E8]" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-[#D4A574] via-[#E8C9A0] to-[#7EC8E3]" />
              <svg className="absolute bottom-[42%] left-0 right-0 h-12 w-full opacity-40" viewBox="0 0 400 20" preserveAspectRatio="none">
                <path d="M0,10 Q50,4 100,10 T200,10 T300,10 T400,10" fill="none" stroke="white" strokeWidth="3" />
                <path d="M0,14 Q80,8 160,14 T320,14 T400,14" fill="none" stroke="white" strokeWidth="2" />
              </svg>
            </>
          ) : null}
        </div>

        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="@container/hs absolute left-0 right-0 top-[clamp(4.5rem,10svh,6rem)] bottom-[clamp(0.5rem,1.8svh,1.25rem)] z-20 cursor-pointer px-[clamp(0.25rem,1.2vw,0.5rem)] lg:top-[clamp(4rem,8svh,5rem)]"
        >
        {!isChatPanelOpen ? (
          <div
            data-chat-control="true"
            className="pointer-events-auto absolute z-30"
            style={bubblePlacement}
            onClick={(event) => event.stopPropagation()}
          >
            <WukooMessageBubble
              message={chatMessage}
              expandLabel={tHome("wukooExpandChat")}
              onExpand={() => setIsChatPanelOpen(true)}
            />
          </div>
        ) : null}
        <div
          className="absolute will-change-transform"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            transform: "translate(-50%, -50%)",
            zIndex: Math.floor(position.y),
            transition: "none",
          }}
        >
          <div className={`relative min-w-0 ${isWalking ? "avatar-walk" : ""}`}>
            <AvatarCharacter config={avatarConfig} direction={direction} />
          </div>
          <div className="absolute bottom-2 left-1/2 -z-10 h-4 w-24 -translate-x-1/2 rounded-[100%] bg-black/10 blur-sm" />
        </div>
        </div>

        <div
          className="@container/chat pointer-events-none absolute bottom-[clamp(1rem,2.5vw,1.5rem)] left-[clamp(1rem,2.5vw,1.5rem)] right-[clamp(1rem,2.5vw,1.5rem)] top-[clamp(0.75rem,2vw,1rem)] z-40 flex min-w-0 flex-col items-stretch justify-end gap-2 sm:left-auto sm:w-[min(20rem,38%,calc(100%-2rem))] sm:min-w-[14rem]"
        >
          {isChatPanelOpen ? (
          <WukooConversationPanel
            messages={displayedChatMessages}
            userAvatarUrl={userAvatarUrl}
            closeLabel={tHome("wukooCloseChat")}
            animateLatestAssistant={shouldAnimateLatestAssistant && !isChatLoading}
            onLatestAssistantAnimationComplete={() => setShouldAnimateLatestAssistant(false)}
            onClose={handleCloseChatPanel}
          />
          ) : null}

          <div className="pointer-events-auto w-full min-w-0">
            <WukooChatPrompt
              label={tHome("wukooChatHint")}
              value={chatInput}
              disabled={isChatLoading}
              onChange={setChatInput}
              onSubmit={handleChatSubmit}
            />
          </div>
        </div>
      </div>

      <div className="relative z-20 mt-[clamp(0.75rem,2vw,1.5rem)] flex flex-wrap items-center justify-between gap-3">
        <div className="font-['Titan_One'] text-2xl font-normal leading-8 tracking-wide text-sky-700">
          {tHome("homesteadCharacterName")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              {
                key: "head" as const,
                iconSrc: "/home-system/head/head.svg",
                label: tHome("homesteadHead"),
              },
              {
                key: "body" as const,
                iconSrc: "/home-system/body/body.svg",
                label: tHome("homesteadBody"),
              },
              {
                key: "hand" as const,
                iconSrc: "/home-system/hand/hand.svg",
                label: tHome("homesteadHand"),
              },
              {
                key: "background" as const,
                iconSrc: "/home-system/background/background.svg",
                label: tHome("homesteadBackground"),
              },
              {
                key: "limited" as const,
                iconSrc: "/dashboard/Star.svg",
                label: tHome("homesteadLimited"),
              },
            ] as const
          ).map((tab) => {
            const isActive = menuOpen && activeCustomizeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  if (menuOpen && activeCustomizeTab === tab.key) {
                    onMenuOpenChange?.(false);
                    return;
                  }
                  onCustomizeTabChange?.(tab.key);
                  onMenuOpenChange?.(true);
                }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-app-body text-base font-medium leading-5 transition-colors"
                style={{
                  backgroundColor: isActive ? "#E45C44" : "#EDF4FC",
                  color: isActive ? "#FFFFFF" : "#045E96",
                }}
              >
                <Image
                  src={tab.iconSrc}
                  alt={tab.label}
                  width={16}
                  height={16}
                  className={`h-4 w-4 ${isActive ? "brightness-0 invert" : ""}`}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`relative z-30 mt-3 grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-out ${
          menuOpen && activeCustomizeTab
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0"
        }`}
        aria-hidden={!menuOpen || !activeCustomizeTab}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative px-[clamp(1rem,2vw,1.25rem)] pb-[clamp(1rem,2vw,1.25rem)] pt-3">
            <div className="overflow-hidden">
              {activeCustomizeTab ? (
                <HomesteadCustomizePanel
                  key={activeCustomizeTab}
                  slot={activeCustomizeTab}
                  items={items}
                  ownedItemIds={ownedItemIds}
                  loadout={loadout}
                  coins={coins}
                  diamonds={diamonds}
                  busyItemId={busyItemId}
                  error={homeSystemError}
                  loading={homeSystemLoading}
                  onRedeem={redeem}
                  onEquip={equip}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes avatar-walk-keyframes {
          0% { transform: rotate(-3deg) translateY(0) scale(1); }
          25% { transform: rotate(2deg) translateY(-5px) scale(1.02); }
          50% { transform: rotate(3deg) translateY(0) scale(1); }
          75% { transform: rotate(-2deg) translateY(-5px) scale(1.02); }
          100% { transform: rotate(-3deg) translateY(0) scale(1); }
        }
        .avatar-walk {
          animation: avatar-walk-keyframes 0.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
