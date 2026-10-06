export type HomeSystemSlot = "head" | "body" | "hand" | "background" | "limited";
export type HomeSystemTier = "free" | "common" | "rare" | "premium" | "limited";

export interface HomeSystemCost {
  coins: number;
  diamonds: number;
  flowers: number;
}

export interface HomeSystemItem {
  item_id: string;
  name: string;
  slot: HomeSystemSlot;
  tier: HomeSystemTier;
  cost: HomeSystemCost;
  is_free?: boolean;
  is_owned?: boolean;
}

export interface HomeSystemLoadout {
  head: string | null;
  body: string | null;
  hand: string | null;
  background: string | null;
  limited: string | null;
}

export interface HomeSystemData {
  items: HomeSystemItem[];
  owned_item_ids: string[];
  loadout: HomeSystemLoadout;
}
