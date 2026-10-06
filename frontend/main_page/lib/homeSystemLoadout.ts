import type { HomeSystemItem, HomeSystemLoadout } from "@/types/homeSystem";
import { HOME_SYSTEM_ARTBOARD } from "@/config/homeSystem";
import { HOME_SYSTEM_BASE_ARTWORK_BOUNDS, getHomeSystemPreviewFrame } from "@/config/homeSystemPreviews";

export function getHomeSystemPreviewLoadout(loadout: HomeSystemLoadout, item: HomeSystemItem): HomeSystemLoadout {
  const preview = { ...loadout, [item.slot]: item.item_id };
  if (item.slot === "limited") {
    preview.head = null;
    preview.body = null;
    preview.hand = null;
  } else if (item.slot !== "background") {
    preview.limited = null;
  }
  return preview;
}

export function getHomeSystemAvatarPreviewFrame(loadout: HomeSystemLoadout) {
  const limited = loadout.limited ? getHomeSystemPreviewFrame(loadout.limited) : null;
  const bounds = limited ? [limited.bounds] : [
    HOME_SYSTEM_BASE_ARTWORK_BOUNDS,
    ...[loadout.head, loadout.body, loadout.hand].flatMap((id) => {
      const frame = id ? getHomeSystemPreviewFrame(id) : null;
      return frame ? [frame.bounds] : [];
    }),
  ];
  const left = Math.min(...bounds.map(([x]) => x));
  const top = Math.min(...bounds.map(([, y]) => y));
  const right = Math.max(...bounds.map(([x, , w]) => x + w));
  const anchor = limited?.bounds ?? HOME_SYSTEM_BASE_ARTWORK_BOUNDS;
  const centerX = anchor[0] + anchor[2] / 2;
  const width = Math.max(centerX - left, right - centerX) * 2;
  const height = Math.max(...bounds.map(([, y, , h]) => y + h)) - top;
  const padding = Math.max(right - left, height) * 0.25;
  return {
    canvas: limited?.canvas ?? HOME_SYSTEM_ARTBOARD,
    bounds: [centerX - width / 2 - padding, top - padding, width + padding * 2, height + padding * 2] as const,
  };
}
