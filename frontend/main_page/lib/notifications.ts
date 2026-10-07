import type { UserNotificationData } from "@/services/notificationsApi";

export type NotificationMessageParts = {
  before: string;
  highlight: string;
  after: string;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  messageParts: NotificationMessageParts | null;
  icon: string;
  time: string;
  iconSrc: string;
  iconAlt: string;
  iconBgClass: string;
  iconImgClass: string;
  unread: boolean;
};

export type NotificationTranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function notificationIcon(
  icon: string,
  t: NotificationTranslateFn,
): {
  src: string;
  alt: string;
  bgClass: string;
  imgClass: string;
} {
  switch (icon) {
    case "achievement":
      return {
        src: "/notification/achievement.svg",
        alt: t("iconAchievement"),
        bgClass: "bg-amber-100",
        imgClass: "h-5 w-5",
      };
    case "course_expire":
      return {
        src: "/notification/course_expire.svg",
        alt: t("iconCourseExpire"),
        bgClass: "bg-purple-100",
        imgClass: "h-5 w-5",
      };
    case "purchase":
      return {
        src: "/notification/purchase.svg",
        alt: t("iconPurchase"),
        bgClass: "bg-rose-100",
        imgClass: "h-5 w-5",
      };
    case "subscription":
    default:
      return {
        src: "/notification/subscription.svg",
        alt: t("iconSubscription"),
        bgClass: "bg-blue-200",
        imgClass: "h-6 w-6",
      };
  }
}

export function parseMessageParts(metadata: Record<string, unknown>): NotificationMessageParts | null {
  const before = metadata.message_before;
  const highlight = metadata.message_highlight;
  const after = metadata.message_after;
  if (
    typeof before === "string" &&
    typeof highlight === "string" &&
    typeof after === "string"
  ) {
    return { before, highlight, after };
  }
  return null;
}

const PURCHASE_TITLE = "Purchase Successful";
const SUBSCRIPTION_ACTIVATED_TITLE = "Subscription Activated";
const SUBSCRIPTION_CANCELED_TITLE = "Subscription Canceled";
const SUBSCRIPTION_UPDATED_TITLE = "Subscription Updated";
const SUBSCRIPTION_RENEWED_TITLE = "Subscription Renewed";

function planLabelFromMetadata(
  metadata: Record<string, unknown>,
  t: NotificationTranslateFn,
): string {
  const plan = metadata.plan;
  if (plan === "plus") return t("plans.plus");
  if (plan === "premium") return t("plans.premium");
  return t("plans.membership");
}

function localizeNotificationContent(
  notification: UserNotificationData,
  t: NotificationTranslateFn,
): { title: string; message: string; messageParts: NotificationMessageParts | null } {
  const metadata = notification.metadata ?? {};
  if (notification.type === "asset_spent") {
    const changes = metadata.changes;
    const parts: string[] = [];
    if (changes && typeof changes === "object") {
      const amounts = changes as Record<string, unknown>;
      for (const asset of ["coins", "diamonds", "flowers"] as const) {
        const amount = Math.abs(Number(amounts[asset] ?? 0));
        if (Number.isFinite(amount) && amount > 0) {
          parts.push(t(`events.assetSpent.${asset}`, { count: amount }));
        }
      }
    }
    const rawSource = typeof metadata.source === "string" ? metadata.source : "";
    const source = rawSource
      .replace(/:/g, " · ")
      .replace(/[-_]/g, " ");
    return {
      title: t("events.assetSpent.title"),
      message: t("events.assetSpent.message", {
        assets: parts.join(t("events.assetSpent.separator")),
        source,
      }),
      messageParts: null,
    };
  }
  const diamonds =
    typeof metadata.diamonds === "number"
      ? metadata.diamonds
      : typeof metadata.diamonds === "string"
        ? Number(metadata.diamonds)
        : undefined;
  const plan = planLabelFromMetadata(metadata, t);

  switch (notification.title) {
    case PURCHASE_TITLE:
      return {
        title: t("events.purchase.title"),
        message: t("events.purchase.message", {
          diamonds: Number.isFinite(diamonds) ? diamonds! : 0,
        }),
        messageParts: null,
      };
    case SUBSCRIPTION_ACTIVATED_TITLE:
      return {
        title: t("events.subscriptionActivated.title"),
        message: t("events.subscriptionActivated.message", { plan }),
        messageParts: null,
      };
    case SUBSCRIPTION_CANCELED_TITLE:
      return {
        title: t("events.subscriptionCanceled.title"),
        message: t("events.subscriptionCanceled.message"),
        messageParts: null,
      };
    case SUBSCRIPTION_UPDATED_TITLE:
      return {
        title: t("events.subscriptionUpdated.title"),
        message: t("events.subscriptionUpdated.message", { plan }),
        messageParts: null,
      };
    case SUBSCRIPTION_RENEWED_TITLE:
      return {
        title: t("events.subscriptionRenewed.title"),
        message: t("events.subscriptionRenewed.message", { plan }),
        messageParts: null,
      };
    default:
      break;
  }

  if (notification.type === "purchase" && Number.isFinite(diamonds)) {
    return {
      title: t("events.purchase.title"),
      message: t("events.purchase.message", { diamonds: diamonds! }),
      messageParts: null,
    };
  }

  if (notification.type === "subscription") {
    const msg = notification.message.toLowerCase();
    if (msg.includes("canceled")) {
      return {
        title: t("events.subscriptionCanceled.title"),
        message: t("events.subscriptionCanceled.message"),
        messageParts: null,
      };
    }
    if (msg.includes("active")) {
      return {
        title: t("events.subscriptionActivated.title"),
        message: t("events.subscriptionActivated.message", { plan }),
        messageParts: null,
      };
    }
    if (msg.includes("updated")) {
      return {
        title: t("events.subscriptionUpdated.title"),
        message: t("events.subscriptionUpdated.message", { plan }),
        messageParts: null,
      };
    }
    if (msg.includes("renewed")) {
      return {
        title: t("events.subscriptionRenewed.title"),
        message: t("events.subscriptionRenewed.message", { plan }),
        messageParts: null,
      };
    }
  }

  return {
    title: notification.title,
    message: notification.message,
    messageParts: parseMessageParts(metadata),
  };
}

export function formatNotificationTime(value: string | null, t: NotificationTranslateFn): string {
  if (!value) {
    return "";
  }

  const createdAt = new Date(value);
  const elapsedMs = Date.now() - createdAt.getTime();
  if (!Number.isFinite(elapsedMs)) {
    return "";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsedMs < minute) {
    return t("timeJustNow");
  }
  if (elapsedMs < hour) {
    const minutes = Math.max(1, Math.floor(elapsedMs / minute));
    return t("timeMinutesAgo", { count: minutes });
  }
  if (elapsedMs < day) {
    const hours = Math.floor(elapsedMs / hour);
    return t("timeHoursAgo", { count: hours });
  }
  if (elapsedMs < 2 * day) {
    return t("timeYesterday");
  }
  const days = Math.floor(elapsedMs / day);
  return t("timeDaysAgo", { count: days });
}

export function mapNotification(
  notification: UserNotificationData,
  t: NotificationTranslateFn,
): NotificationItem {
  const icon = notificationIcon(notification.icon, t);
  const { title, message, messageParts } = localizeNotificationContent(notification, t);
  return {
    id: notification.id,
    type: notification.type,
    title,
    message,
    messageParts,
    icon: notification.icon,
    iconSrc: icon.src,
    iconAlt: icon.alt,
    iconBgClass: icon.bgClass,
    iconImgClass: icon.imgClass,
    time: formatNotificationTime(notification.created_at, t),
    unread: !notification.is_read,
  };
}

export const NOTIFICATION_VISIBLE_LIMIT = 4;
export const NOTIFICATION_LIST_GAP_PX = 12;
export const NOTIFICATION_LIST_PADDING_Y_PX = 24;
export const NOTIFICATION_FALLBACK_ITEM_HEIGHT_PX = 104;
export const NOTIFICATION_PANEL_WIDTH = 465;

export function measureNotificationListCap(listRoot: HTMLElement): number | null {
  const items = Array.from(listRoot.querySelectorAll<HTMLElement>("[data-notification-item]"));
  if (items.length <= NOTIFICATION_VISIBLE_LIMIT) {
    return null;
  }

  let contentHeight = 0;
  for (let i = 0; i < NOTIFICATION_VISIBLE_LIMIT; i += 1) {
    if (i > 0) {
      contentHeight += NOTIFICATION_LIST_GAP_PX;
    }
    const measured = items[i].getBoundingClientRect().height || items[i].offsetHeight;
    contentHeight += measured;
  }

  if (contentHeight <= 0) {
    contentHeight =
      NOTIFICATION_VISIBLE_LIMIT * NOTIFICATION_FALLBACK_ITEM_HEIGHT_PX +
      (NOTIFICATION_VISIBLE_LIMIT - 1) * NOTIFICATION_LIST_GAP_PX;
  }

  return Math.ceil(contentHeight);
}
