import { PortalApiError, PortalGameClient, type Grant } from './portal-client';

/** Browser-side retries are scoped to the signed-in game account. */
export class PortalInventoryClient extends PortalGameClient {
  private readonly pending = new Map<string, string>();
  private readonly busy = new Set<string>();

  constructor(base: string, slug: string, private readonly accountId: () => number | null,
    gameKey = slug) {
    super(base, slug, gameKey);
    this.storagePrefix = `portal-commerce:${base}:${gameKey}:`;
  }

  private readonly storagePrefix: string;

  private key(operation: string): string {
    const userId = this.accountId();
    if (!Number.isSafeInteger(userId) || !userId || userId < 0) {
      throw new PortalApiError(401, 'game_account_required');
    }
    return `${this.storagePrefix}${userId}:${operation}`;
  }

  private read(key: string): string | null {
    try { return sessionStorage.getItem(key) ?? this.pending.get(key) ?? null; }
    catch { return this.pending.get(key) ?? null; }
  }

  private write(key: string, value: string): void {
    this.pending.set(key, value);
    try { sessionStorage.setItem(key, value); } catch { /* In-memory retries still work. */ }
  }

  private remove(key: string): void {
    this.pending.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
  }

  async assertAccount(): Promise<void> {
    const expected = this.accountId();
    const session = await this.refreshSession();
    if (!expected || session.user.id !== expected) {
      throw new PortalApiError(401, 'portal_account_mismatch');
    }
  }

  private async mutate<T>(operation: string, send: (id: string) => Promise<T>,
    keep = false): Promise<T> {
    const key = this.key(operation);
    if (this.busy.has(key)) throw new PortalApiError(409, 'operation_in_progress');
    this.busy.add(key);
    try {
      await this.assertAccount();
      let id = this.read(key);
      if (!id) { id = crypto.randomUUID(); this.write(key, id); }
      const result = await send(id);
      if (!keep) this.remove(key);
      return result;
    } catch (error) {
      if (keep && error instanceof PortalApiError && error.code === 'purchase_session_expired') {
        this.remove(key);
      }
      throw error;
    } finally {
      this.busy.delete(key);
    }
  }

  buyItem(itemId: string) {
    return this.mutate(`redeem:${itemId}`, id => this.redeemItem({ item_id: itemId, request_id: id }));
  }

  useItem(itemId: string, count = 1) {
    return this.mutate(`consume:${itemId}:${count}`, id => this.consumeItem(
      { item_id: itemId, request_id: id }, count));
  }

  hasPendingUse(itemId: string, count = 1): boolean {
    try { return !!this.read(this.key(`consume:${itemId}:${count}`)); }
    catch { return false; }
  }

  buyGrant(productId: string, target: string): Promise<Grant> {
    return this.mutate(`grant:${productId}:${target}`, id => this.redeemGrant(
      productId, { target, request_id: id }), true);
  }

  finishGrant(productId: string, target: string): void {
    this.remove(this.key(`grant:${productId}:${target}`));
  }
}

/** This identifies browser retry storage; the server verifies authentication. */
export function gameAccountId(token: string | null): number | null {
  try {
    const part = token?.split('.')[1];
    if (!part) return null;
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isSafeInteger(claims.user_id) && claims.user_id > 0 ? claims.user_id : null;
  } catch { return null; }
}
