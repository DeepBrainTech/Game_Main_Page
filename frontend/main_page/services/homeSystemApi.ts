import { credentialedFetch, getApiUrl, getAuthHeaders, readApiErrorDetail } from "@/services/apiClient";
import type { HomeSystemData, HomeSystemLoadout } from "@/types/homeSystem";

export async function fetchHomeSystem(): Promise<HomeSystemData> {
  const res = await credentialedFetch(getApiUrl("/api/user/home-system"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await readApiErrorDetail(res));
  const json = await res.json();
  if (!json?.data) throw new Error("invalid_home_system_response");
  return json.data as HomeSystemData;
}

export async function redeemHomeSystemItem(itemId: string) {
  const query = new URLSearchParams({ item_id: itemId, equip: "true" });
  const res = await credentialedFetch(getApiUrl(`/api/user/home-system/redeem?${query.toString()}`), {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await readApiErrorDetail(res));
  const json = await res.json();
  if (!json?.data?.loadout) throw new Error("redeem_home_system_failed");
  return json.data as { item_id: string; assets: { coins: number; diamonds: number; flowers: number }; loadout: HomeSystemLoadout };
}

export async function updateHomeSystemLoadout(slot: keyof HomeSystemLoadout, itemId: string | null) {
  const res = await credentialedFetch(getApiUrl("/api/user/home-system/loadout"), {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ slot, item_id: itemId }),
  });
  if (!res.ok) throw new Error(await readApiErrorDetail(res));
  const json = await res.json();
  if (!json?.data?.loadout) throw new Error("update_home_system_loadout_failed");
  return json.data.loadout as HomeSystemLoadout;
}
