import { HOME_SYSTEM_ARTBOARD } from "@/config/homeSystem";

// Alpha bounds frame the supplied artwork in thumbnails and purchase previews.
// Full character overlays continue to use the complete image canvas.
export const HOME_SYSTEM_BASE_ARTWORK_BOUNDS = [881, 200, 1173, 1316] as const;

const artworkBounds: Record<string, readonly [number, number, number, number]> = {
  "head-glasses": [1112, 518, 674, 215],
  "body-blue-tshirt": [1221, 864, 478, 305],
  "head-paper-hat": [1146, 72, 586, 379],
  "body-sweater": [1045, 864, 828, 344],
  "head-headphones": [1001, 298, 878, 764],
  "body-speaker": [854, 854, 1108, 584],
  "head-astronaut-helmet": [1008, 170, 854, 840],
  "body-wizard-cloak": [1045, 864, 829, 454],
  "head-wizard-hat": [1015, 51, 1479, 566],
  "body-wizard-wand": [877, 855, 289, 397],
  "body-pirate-costume": [1090, 786, 759, 749],
  "head-pirate-bandana": [1084, 316, 747, 585],
  "body-pirate-sword": [847, 877, 461, 292],
  "body-thanksgiving-outfit": [1010, 851, 860, 591],
  "head-thanksgiving-headpiece": [1013, 116, 803, 730],
  "body-thanksgiving-handpiece": [661, 944, 417, 428],
  "body-fireworks-outfit": [1081, 858, 665, 688],
  "head-fireworks-headpiece": [1098, 190, 1103, 1037],
  "body-fireworks-handpiece": [855, 838, 352, 308],
  "limited-jindouyun-monkey": [171, 69, 625, 600],
};

// Ignore isolated export artifacts when centering the accessory thumbnails.
// Purchase previews retain the full overlay bounds used by the character.
const thumbnailBounds: Record<string, readonly [number, number, number, number]> = {
  "head-wizard-hat": [1013, 51, 893, 566],
  "head-fireworks-headpiece": [1097, 189, 624, 285],
};

export function getHomeSystemThumbnailFrame(itemId: string) {
  const frame = getHomeSystemPreviewFrame(itemId);
  return frame ? { ...frame, bounds: thumbnailBounds[itemId] ?? frame.bounds } : null;
}

export function getHomeSystemPreviewFrame(itemId: string) {
  const bounds = artworkBounds[itemId];
  if (!bounds) return null;
  const canvas = itemId === "limited-jindouyun-monkey"
    ? { width: 946, height: 709 }
    : HOME_SYSTEM_ARTBOARD;
  return { bounds, canvas };
}
