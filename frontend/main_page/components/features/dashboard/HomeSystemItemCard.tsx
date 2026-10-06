"use client";

/* eslint-disable @next/next/no-img-element */

import { useTranslations } from "next-intl";
import { getHomeSystemItemPreview } from "@/config/homeSystem";
import { getHomeSystemThumbnailFrame } from "@/config/homeSystemPreviews";
import { homeSystemPreviewBackgrounds } from "@/config/homeSystemStyles";
import type { HomeSystemItem } from "@/types/homeSystem";

interface HomeSystemItemCardProps {
  item: HomeSystemItem;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  busy: boolean;
  pending: boolean;
  previewOnly?: boolean;
  onSelect: () => void;
}

export default function HomeSystemItemCard({
  item, owned, equipped, affordable, busy, pending, previewOnly = false, onSelect,
}: HomeSystemItemCardProps) {
  const tHome = useTranslations("dashboard");
  const itemName = tHome(`homesteadItems.${item.item_id}`);
  const insufficient = !owned && !affordable;
  const actionLabel = busy
    ? tHome("homesteadSaving")
    : insufficient
      ? tHome("homesteadErrors.insufficientAssets")
      : tHome(owned ? equipped ? "homesteadUnequip" : "homesteadEquip" : "homesteadRedeem");
  const preview = getHomeSystemItemPreview(item.item_id);
  const frame = getHomeSystemThumbnailFrame(item.item_id);
  const priceIcon = item.cost.diamonds > 0
    ? "/dashboard/dimond.svg"
    : item.cost.coins > 0 ? "/home-system/coin.svg" : null;
  const price = item.cost.diamonds || item.cost.coins;

  return (
    <button
      type="button"
      aria-label={`${itemName} — ${actionLabel}`}
      aria-pressed={equipped}
      aria-busy={busy}
      aria-hidden={previewOnly || undefined}
      tabIndex={previewOnly ? -1 : undefined}
      title={`${itemName} — ${actionLabel}`}
      disabled={previewOnly || pending}
      onClick={onSelect}
      className={`group relative flex h-[var(--item-height)] w-full min-w-0 flex-col gap-3 rounded-[1.2rem] border-[0.15rem] p-[0.875rem] text-center transition-[border-color,box-shadow] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#045E96] disabled:cursor-not-allowed ${
        equipped
          ? "border-[#045E96] bg-[#D4EAF8]"
          : owned
            ? "border-transparent bg-[#D4EAF8] enabled:hover:border-[#045E96]"
            : "border-transparent bg-[#EDF4FC] enabled:hover:border-[#D4EAF8]"
      }`}
    >
      <span
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[0.9rem]"
        style={{ background: homeSystemPreviewBackgrounds[item.tier] }}
      >
        {preview ? frame ? (
          <span className="absolute inset-x-2 inset-y-1">
            <svg
              className="block h-full w-full"
              viewBox={frame.bounds.join(" ")}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <image href={preview} width={frame.canvas.width} height={frame.canvas.height} />
            </svg>
          </span>
        ) : (
          <img
            src={preview}
            alt=""
            className={`h-full w-full ${item.slot === "background" ? "object-cover" : "object-contain"}`}
            draggable={false}
          />
        ) : null}
      </span>
      <span className={`flex min-h-[1.4777rem] w-full shrink-0 items-center justify-center gap-2 font-app-body text-base font-medium leading-[1.4777rem] ${insufficient ? "text-[#E45C44]" : "text-[#045E96]"}`}>
        {busy ? (
          <span className="text-xs">{tHome("homesteadSaving")}</span>
        ) : owned ? (
          <span>{tHome(equipped ? "homesteadEquipped" : "homesteadOwned")}</span>
        ) : (
          <>
            {priceIcon ? <img src={priceIcon} alt="" className="shrink-0" /> : null}
            <span>{price || tHome("homesteadFree")}</span>
          </>
        )}
      </span>
    </button>
  );
}
