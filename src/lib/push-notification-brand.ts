/** Square Rocha mark — same asset as {@link BrandLogo} (`public/brand/rocha-mark-v2.png`). */
export const PUSH_NOTIFICATION_ICON_PATH = "/brand/rocha-mark-v2.png";

export function pushNotificationIconUrl(origin?: string | null): string {
  const base = origin?.replace(/\/$/, "") ?? "";
  if (base) return `${base}${PUSH_NOTIFICATION_ICON_PATH}`;
  return PUSH_NOTIFICATION_ICON_PATH;
}

/** OS/Web Push `icon` + `badge` pair (absolute URL when origin is known). */
export function pushNotificationBrandAssets(origin?: string | null): {
  icon: string;
  badge: string;
} {
  const url = pushNotificationIconUrl(origin);
  return { icon: url, badge: url };
}
