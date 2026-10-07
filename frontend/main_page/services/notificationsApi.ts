import { credentialedFetch, getApiUrl, getAuthHeaders } from "@/services/apiClient";

export interface UserNotificationData {
  id: number;
  type: "subscription" | "purchase" | string;
  title: string;
  message: string;
  icon: "subscription" | "purchase" | string;
  is_read: boolean;
  created_at: string | null;
  read_at: string | null;
  metadata: Record<string, unknown>;
}

export async function fetchNotifications(limit = 20, beforeId?: number): Promise<{
  notifications: UserNotificationData[];
  unread_count: number;
}> {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const cursor = beforeId ? `&before_id=${encodeURIComponent(String(beforeId))}` : "";
  const res = await credentialedFetch(getApiUrl(`/api/notifications?limit=${safeLimit}${cursor}`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("fetch_notifications_failed");
  const json = await res.json();
  return {
    notifications: (json?.data?.notifications ?? []) as UserNotificationData[],
    unread_count: Number(json?.data?.unread_count ?? 0),
  };
}

export function subscribeToNotificationEvents(
  onNotification: () => void,
  onConnectionChange: (connected: boolean) => void,
): EventSource | null {
  if (typeof EventSource === "undefined") return null;
  const source = new EventSource(getApiUrl("/api/notifications/events"), {
    withCredentials: true,
  });
  source.addEventListener("notification", onNotification);
  source.onopen = () => onConnectionChange(true);
  source.onerror = () => onConnectionChange(false);
  return source;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await credentialedFetch(getApiUrl("/api/notifications/mark-all-read"), {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("mark_notifications_read_failed");
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  const res = await credentialedFetch(getApiUrl(`/api/notifications/${notificationId}/read`), {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("mark_notification_read_failed");
}
