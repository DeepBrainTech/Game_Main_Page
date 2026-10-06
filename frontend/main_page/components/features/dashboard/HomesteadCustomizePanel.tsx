"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import HomeSystemItemCard from "./HomeSystemItemCard";
import HomeSystemPurchaseModal from "./HomeSystemPurchaseModal";
import { useSingleRowCapacity } from "@/hooks/useSingleRowCapacity";
import { useContainedWheelScroll } from "@/hooks/useContainedWheelScroll";
import type {
  HomeSystemItem,
  HomeSystemLoadout,
  HomeSystemSlot,
} from "@/types/homeSystem";

interface HomesteadCustomizePanelProps {
  slot: HomeSystemSlot;
  items: HomeSystemItem[];
  ownedItemIds: Set<string>;
  loadout: HomeSystemLoadout;
  coins: number;
  diamonds: number;
  busyItemId: string | null;
  error: string | null;
  loading: boolean;
  onRedeem: (itemId: string) => Promise<boolean>;
  onEquip: (slot: HomeSystemSlot, itemId: string | null) => Promise<void>;
}

function getErrorMessage(tHome: ReturnType<typeof useTranslations>, error: string | null) {
  if (!error) return null;
  const knownErrors: Record<string, string> = {
    insufficient_assets: tHome("homesteadErrors.insufficientAssets"),
    already_owned: tHome("homesteadErrors.alreadyOwned"),
    item_not_owned: tHome("homesteadErrors.itemNotOwned"),
  };
  return knownErrors[error] ?? tHome("homesteadErrors.generic");
}

export default function HomesteadCustomizePanel({
  slot,
  items,
  ownedItemIds,
  loadout,
  coins,
  diamonds,
  busyItemId,
  error,
  loading,
  onRedeem,
  onEquip,
}: HomesteadCustomizePanelProps) {
  const tHome = useTranslations("dashboard");
  const [expanded, setExpanded] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<HomeSystemItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const listId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const slotItems = items.filter((item) => item.slot === slot);
  useContainedWheelScroll(listRef, expanded && !loading && slotItems.length > 0);
  const { rowRef, visibleCount, capacity, cardWidth } = useSingleRowCapacity(loading ? 4 : slotItems.length);
  const hasMoreItems = (loading ? 4 : slotItems.length) > visibleCount;
  const visibleItems = expanded ? slotItems : slotItems.slice(0, visibleCount + Number(hasMoreItems));
  const setListRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    rowRef(node);
  }, [rowRef]);
  const equippedItemId = loadout[slot];
  const errorMessage = getErrorMessage(tHome, error);

  const canAfford = (item: HomeSystemItem) =>
    coins >= item.cost.coins && diamonds >= item.cost.diamonds;
  const listClassName = `grid gap-[var(--item-gap)] px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
    expanded
      ? "grid-cols-[repeat(var(--item-columns),var(--item-width))] max-h-[calc(2*var(--item-height)+var(--item-gap)+0.5rem)] overflow-x-hidden overflow-y-auto"
      : "grid-flow-col auto-cols-[var(--item-width)] justify-start overflow-hidden"
  }`;

  return (
    <div
      className="min-w-0 space-y-3 [--item-gap:1rem] [--item-target-width:9rem] [--item-height:calc(var(--item-width)*146/144)] [--item-peek:1.5rem]"
      style={{ "--item-columns": capacity, "--item-width": `${cardWidth}px` } as CSSProperties}
    >
      {errorMessage ? (
        <p className="rounded-2xl bg-[#FFF5F5] px-3 py-2 font-app-body text-xs font-medium text-[#E45C44]">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <div id={listId} ref={rowRef} className={listClassName} aria-busy="true" aria-label={tHome("homesteadLoading")}>
          {Array.from({ length: expanded ? 4 : visibleCount + Number(hasMoreItems) }).map((_, index) => (
            <div
              key={index}
              className="h-[var(--item-height)] w-full min-w-0 animate-pulse rounded-[1.25rem] bg-[#EDF4FC]"
            />
          ))}
        </div>
      ) : slotItems.length === 0 ? (
        <div className="rounded-2xl bg-[#EDF4FC] px-4 py-5 text-center font-app-body text-sm text-slate-500">
          {tHome("homesteadNoItemsYet")}
        </div>
      ) : (
        <div
          id={listId}
          ref={setListRef}
          className={listClassName}
          role="region"
          aria-label={tHome(`homesteadSlots.${slot}`)}
          tabIndex={0}
        >
          {visibleItems.map((item, index) => {
            const isEquipped = equippedItemId === item.item_id;
            const isOwned = isEquipped || ownedItemIds.has(item.item_id) || item.is_owned === true || item.is_free === true;

            return (
              <HomeSystemItemCard
                key={item.item_id}
                item={item}
                owned={isOwned}
                equipped={isEquipped}
                affordable={canAfford(item)}
                busy={busyItemId === item.item_id}
                pending={busyItemId !== null}
                previewOnly={!expanded && index === visibleCount}
                onSelect={() => {
                  if (isOwned) {
                    void onEquip(item.slot, isEquipped ? null : item.item_id);
                  } else {
                    setPurchaseItem(item);
                  }
                }}
              />
            );
          })}
        </div>
      )}
      {loading || slotItems.length > 0 ? (
        <div className="flex justify-center">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            disabled={loading}
            onClick={() => {
              listRef.current?.scrollTo({ top: 0, left: 0 });
              setExpanded((current) => !current);
            }}
            className="inline-flex items-center justify-center gap-2.5 rounded-full px-4 py-2 font-app-body text-base font-medium leading-5 text-[#045E96] transition-colors hover:bg-[#EDF4FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#045E96] disabled:opacity-50"
          >
            {tHome(expanded ? "homesteadCollapse" : "homesteadExpand")}
            <img
              src="/home-system/expand.svg"
              alt=""
              aria-hidden="true"
              className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : null}
      {purchaseItem ? (
        <HomeSystemPurchaseModal
          item={purchaseItem}
          loadout={loadout}
          coins={coins}
          diamonds={diamonds}
          busy={confirming || busyItemId !== null}
          error={errorMessage}
          onClose={() => { if (!confirmingRef.current) setPurchaseItem(null); }}
          onConfirm={async () => {
            if (confirmingRef.current || !canAfford(purchaseItem)) return;
            confirmingRef.current = true;
            setConfirming(true);
            try {
              if (await onRedeem(purchaseItem.item_id)) setPurchaseItem(null);
            } finally {
              confirmingRef.current = false;
              setConfirming(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
