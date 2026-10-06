const configuredAssetBase = process.env.NEXT_PUBLIC_HOME_SYSTEM_ASSET_BASE_URL?.replace(/\/$/, "");
export const HOME_SYSTEM_ASSET_BASE_URL = configuredAssetBase || "/home-system";

// The base character defines the responsive avatar container.
export const HOME_SYSTEM_ARTBOARD = {
  width: 2732,
  height: 2048,
} as const;

function asset(path: string): string {
  return `${HOME_SYSTEM_ASSET_BASE_URL}/${path}`;
}

export const HOME_SYSTEM_DEFAULT_BACKGROUND_ID = "background-green-free";

export function getHomeSystemBaseAsset(): string {
  return asset("default.png");
}

interface HomeSystemItemVisual {
  primary?: string;
  preview?: string;
}

function backgroundVisual(name: string): HomeSystemItemVisual {
  return {
    primary: asset(`backgrounds/${name}.webp`),
    preview: asset(`backgrounds/thumbnails/${name}.webp`),
  };
}

const itemVisuals: Record<string, HomeSystemItemVisual> = {
  // Overlay the supplied exports without per-item offsets or scale corrections.
  "head-glasses": { primary: asset("accessories/head/glasses_head.png") },
  "body-blue-tshirt": {
    primary: asset("accessories/body/blueshirt_body.png"),
  },
  "head-paper-hat": { primary: asset("accessories/head/paperboat_head.png") },
  "body-sweater": {
    primary: asset("accessories/body/sweater_body.png"),
  },
  "head-headphones": {
    primary: asset("accessories/head/headphones_head.png"),
  },
  "body-speaker": { primary: asset("accessories/hand/speaker_hand.png") },
  "head-astronaut-helmet": {
    primary: asset("accessories/head/helmet_head.png"),
  },
  "body-wizard-cloak": {
    primary: asset("accessories/body/wizard_body.png"),
  },
  "head-wizard-hat": {
    primary: asset("accessories/head/wizard_head.png"),
  },
  "body-wizard-wand": {
    primary: asset("accessories/hand/wizard_hand.png"),
  },
  "body-pirate-costume": {
    primary: asset("accessories/body/pirate_body.png"),
  },
  "head-pirate-bandana": {
    primary: asset("accessories/head/pirate_head.png"),
  },
  "body-pirate-sword": {
    primary: asset("accessories/hand/pirate_hand.png"),
  },
  "body-thanksgiving-outfit": {
    primary: asset("accessories/body/thanksgiving_body.png"),
  },
  "head-thanksgiving-headpiece": {
    primary: asset("accessories/head/thanksgiving_head.png"),
  },
  "body-thanksgiving-handpiece": {
    primary: asset("accessories/hand/thanksgiving_hand.png"),
  },
  "body-fireworks-outfit": {
    primary: asset("accessories/body/firework_body.png"),
  },
  "head-fireworks-headpiece": {
    primary: asset("accessories/head/firework_head.png"),
  },
  "body-fireworks-handpiece": {
    primary: asset("accessories/hand/firework_hand.png"),
  },
  "background-fireworks": backgroundVisual("firework_bg"),
  "background-cloudy": backgroundVisual("cloud_bg"),
  "background-beach": backgroundVisual("beach_bg"),
  "background-green-free": backgroundVisual("green_background"),
  "background-red-free": backgroundVisual("red_background"),
  "background-blue-free": backgroundVisual("blue_background"),
  "background-chessmater": backgroundVisual("chessmater_bg"),
  "limited-jindouyun-monkey": { primary: asset("limited-1.svg") },
};

export function getHomeSystemVisual(itemId: string | null | undefined) {
  return itemId ? itemVisuals[itemId] : undefined;
}

export function getHomeSystemItemPreview(itemId: string): string | undefined {
  const visual = itemVisuals[itemId];
  return visual?.preview ?? visual?.primary;
}
