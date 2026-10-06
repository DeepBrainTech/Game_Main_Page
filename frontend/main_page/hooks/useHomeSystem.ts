"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHomeSystem,
  redeemHomeSystemItem,
  updateHomeSystemLoadout,
} from "@/services/homeSystemApi";
import { notifyRewardsUpdated } from "@/lib/reward-events";
import type { HomeSystemData, HomeSystemLoadout, HomeSystemSlot } from "@/types/homeSystem";

export function useHomeSystem() {
  const [data, setData] = useState<HomeSystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    if (!loadedRef.current) setLoading(true);
    try {
      const next = await fetchHomeSystem();
      setData(next);
      loadedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "home_system_load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const redeem = useCallback(async (itemId: string) => {
    setBusyItemId(itemId);
    setError(null);
    try {
      const result = await redeemHomeSystemItem(itemId);
      setData((current) =>
        current
          ? {
              ...current,
              loadout: result.loadout,
              owned_item_ids: [...new Set([...current.owned_item_ids, itemId])],
              items: current.items.map((item) => (item.item_id === itemId ? { ...item, is_owned: true } : item)),
            }
          : current
      );
      notifyRewardsUpdated();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "redeem_home_system_failed";
      setError(message);
      return false;
    } finally {
      setBusyItemId(null);
    }
  }, []);

  const equip = useCallback(async (slot: HomeSystemSlot, itemId: string | null) => {
    setBusyItemId(itemId ?? `clear-${slot}`);
    setError(null);
    try {
      const loadout = await updateHomeSystemLoadout(slot, itemId);
      setData((current) => (current ? { ...current, loadout } : current));
    } catch (e) {
      const message = e instanceof Error ? e.message : "update_home_system_loadout_failed";
      setError(message);
    } finally {
      setBusyItemId(null);
    }
  }, []);

  const loadout: HomeSystemLoadout = data?.loadout ?? {
    head: null,
    body: null,
    hand: null,
    background: null,
    limited: null,
  };

  return {
    items: data?.items ?? [],
    ownedItemIds: new Set(data?.owned_item_ids ?? []),
    loadout,
    loading,
    busyItemId,
    error,
    redeem,
    equip,
    refresh: load,
  };
}
