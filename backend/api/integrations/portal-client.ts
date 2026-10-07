/** Copy this module into a game's browser client. No framework dependencies. */
export type Assets = { coins: number; diamonds: number; flowers: number };
export type Cost = Partial<Assets>;
export type PurchaseRequest = { request_id: string; target: string };
export type ItemRequest = { request_id: string; item_id: string };
export type GameSession = {
  game_token: string;
  expires_in: number;
  user: { id: number; username: string };
};
export type Grant = {
  grant_token: string;
  purchase_id: string;
  expires_at: number;
  game_key: string;
  product_id: string;
  user_id: number;
  assets: Assets;
  cost: Cost;
};
export type Quote = {
  game_key: string;
  product_id: string;
  duration_seconds: number;
  user_id: number;
  assets: Assets;
  cost: Cost;
};
export type RedeemedItem = {
  item_id: string;
  item_name: string;
  games: string[];
  game_mode: string | null;
  cost: Assets;
  inventory_quantity: number;
  assets: Assets;
};

export class PortalApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
    this.name = "PortalApiError";
  }
}

export class PortalGameClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly apiSlug: string, private readonly gameKey = apiSlug) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      const detail = payload?.detail;
      const code = typeof detail === "string" ? detail
        : Array.isArray(detail) ? "validation_error"
        : typeof payload?.message === "string" ? payload.message : "portal_request_failed";
      throw new PortalApiError(response.status, code);
    }
    return payload.data as T;
  }

  private purchasePath(productId: string): string {
    return "/api/games/" + encodeURIComponent(this.apiSlug)
      + "/purchases/" + encodeURIComponent(productId);
  }

  assets(): Promise<Assets> {
    return this.request("/api/user/assets");
  }

  inventory(): Promise<{ items: { item_id: string; quantity: number }[] }> {
    return this.request("/api/user/shop/inventory");
  }

  catalog(): Promise<{ items: Record<string, { name: string; games: string[]; cost: Assets }>; game_mode: string }> {
    const query = new URLSearchParams({ game_mode: this.gameKey });
    return this.request("/api/games/shop/catalog?" + query);
  }

  startSession(timezone?: string): Promise<GameSession & { assets: Assets }> {
    return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/token", {
      method: "POST",
      headers: timezone ? { "X-User-Timezone": timezone } : undefined,
    });
  }

  refreshSession(): Promise<GameSession> {
    return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/session");
  }

  quote(productId: string): Promise<Quote> {
    return this.request(this.purchasePath(productId) + "/quote");
  }

  redeemGrant(productId: string, request: PurchaseRequest): Promise<Grant> {
    return this.request(this.purchasePath(productId) + "/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    });
  }

  redeemItem(request: ItemRequest): Promise<RedeemedItem> {
    const query = new URLSearchParams({ ...request, game_mode: this.gameKey });
    return this.request("/api/user/shop/redeem?" + query, { method: "POST" });
  }

  consumeItem(request: ItemRequest, count = 1): Promise<{
    item_id: string; consumed_count: number; inventory_quantity: number; game_mode: string;
  }> {
    const query = new URLSearchParams({ ...request, count: String(count), game_mode: this.gameKey });
    return this.request("/api/user/shop/consume?" + query, { method: "POST" });
  }

  checkout(asset: "coins" | "diamonds", bundleId: string, locale: string): Promise<{ url: string }> {
    const kind = asset === "coins" ? "coin" : "diamond";
    return this.request("/api/billing/" + kind + "-checkout-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle_id: bundleId, locale }),
    });
  }
}

/** Generate once per user action, then keep this object when retrying a lost response. */
export function newPurchaseRequest(target: string): PurchaseRequest {
  return { request_id: crypto.randomUUID(), target };
}

export function newItemRequest(itemId: string): ItemRequest {
  return { request_id: crypto.randomUUID(), item_id: itemId };
}
