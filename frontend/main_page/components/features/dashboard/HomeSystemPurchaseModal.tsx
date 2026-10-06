"use client";

/* eslint-disable @next/next/no-img-element */

import { useId } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { useRouter } from "@/lib/i18n-navigation";
import { getHomeSystemVisual } from "@/config/homeSystem";
import { getHomeSystemPreviewLoadout, getHomeSystemAvatarPreviewFrame } from "@/lib/homeSystemLoadout";
import type { HomeSystemItem, HomeSystemLoadout } from "@/types/homeSystem";
import AvatarCharacter from "./AvatarCharacter";

interface HomeSystemPurchaseModalProps {
  item: HomeSystemItem;
  loadout: HomeSystemLoadout;
  coins: number;
  diamonds: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function HomeSystemPurchaseModal({ item, loadout, coins, diamonds, busy, error, onClose, onConfirm }: HomeSystemPurchaseModalProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const titleId = useId();
  const name = t(`homesteadItems.${item.item_id}`);
  const preview = getHomeSystemPreviewLoadout(loadout, item);
  const background = getHomeSystemVisual(preview.background)?.primary;
  const isBackgroundPreview = item.slot === "background" && Boolean(background);
  const insufficientCoins = coins < item.cost.coins;
  const insufficientDiamonds = diamonds < item.cost.diamonds;
  const insufficient = insufficientCoins || insufficientDiamonds;
  const label = busy ? t("homesteadPurchase.purchasing")
    : insufficientCoins ? t("homesteadPurchase.notEnoughCoins")
      : insufficientDiamonds ? t("homesteadPurchase.notEnoughDiamonds")
        : t("homesteadPurchase.confirm");
  const icon = item.cost.diamonds > 0 ? "/dashboard/dimond.svg" : "/home-system/coin.svg";

  return (
    <Modal labelledBy={titleId} busy={busy} onClose={onClose} className="max-w-[31.25rem] rounded-3xl shadow-[0px_20px_15px_rgba(0,0,0,0.15)]">
      <div className="relative p-6 sm:p-8">
        <button
          type="button"
          autoFocus
          onClick={onClose}
          disabled={busy}
          aria-label={t("homesteadPurchase.close")}
          className="absolute right-6 top-6 z-10 flex size-6 items-center justify-center rounded-full hover:bg-[#EDF4FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#045E96] disabled:opacity-50"
        >
          <img src="/home-system/purchase-close.svg" alt="" />
        </button>
        <div
          role="img"
          aria-label={t("homesteadPurchase.preview", { item: name })}
          className={`relative -mx-6 overflow-hidden sm:-mx-8 ${isBackgroundPreview ? "mb-6 aspect-[1920/1070]" : "aspect-[500/317]"}`}
        >
          {isBackgroundPreview ? <img src={background} alt="" className="absolute inset-0 h-full w-full object-contain" /> : null}
          <div className={isBackgroundPreview ? "absolute bottom-[4%] left-[29%] h-[70%] w-[42%]" : "absolute inset-0 p-3"}>
            <AvatarCharacter
            interactive={false}
            previewFrame={getHomeSystemAvatarPreviewFrame(preview)}
            className="h-full w-full"
            config={{
              headAsset: getHomeSystemVisual(preview.head)?.primary,
              bodyAsset: getHomeSystemVisual(preview.body)?.primary,
              handAsset: getHomeSystemVisual(preview.hand)?.primary,
              limitedAsset: getHomeSystemVisual(preview.limited)?.primary,
            }}
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 id={titleId} className="font-['Titan_One'] text-xl leading-[1.4777rem]">{name}</h2>
          <div className={`flex items-center justify-center gap-2 font-app-body text-xl font-medium leading-[1.4777rem] ${insufficient ? "text-[#E45C44]" : "text-[#045E96]"}`}>
            <img src={icon} alt="" />
            <span>{item.cost.diamonds || item.cost.coins}</span>
          </div>
        </div>
        {error ? <p role="alert" className="mt-4 text-center font-app-body text-sm text-[#E45C44]">{error}</p> : null}
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || insufficient}
          className="mt-6 min-h-[3.75rem] w-full rounded-full bg-[#E45C44] px-4 py-3 font-app-body text-lg font-semibold leading-[1.6875rem] text-white shadow-[0px_5px_10px_rgba(228,92,68,0.2)] hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E45C44] disabled:bg-[#E2E2E2] disabled:text-[#999999] disabled:shadow-none"
        >
          {label}
        </button>
        {insufficient ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onClose();
              router.push("/shop");
            }}
            className="mt-3 min-h-[3.75rem] w-full rounded-full bg-[#E45C44] px-4 py-3 font-app-body text-lg font-semibold leading-[1.6875rem] text-white shadow-[0px_5px_10px_rgba(228,92,68,0.2)] hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E45C44] disabled:opacity-50"
          >
            {t(insufficientCoins ? "homesteadPurchase.getCoins" : "homesteadPurchase.getDiamonds")}
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
