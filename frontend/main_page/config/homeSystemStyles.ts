import type { HomeSystemTier } from "@/types/homeSystem";

const tier1Background = "linear-gradient(180deg, #B2E9FF 0%, #F7FDFF 100%)";
const tier2Background = "linear-gradient(180deg, #B0C0FF 0%, #F8EFFF 100%)";
const tier3Background = "linear-gradient(180deg, #FFBF87 0%, #FFFDD7 100%)";

export const homeSystemPreviewBackgrounds: Record<HomeSystemTier, string> = {
  free: tier1Background,
  common: tier1Background,
  rare: tier2Background,
  premium: tier3Background,
  limited: tier3Background,
};
