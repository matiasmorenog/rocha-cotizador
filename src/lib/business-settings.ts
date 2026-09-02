import { db } from "@/lib/db";
import { ORDER_CUTOFF_HOUR_AR } from "@/lib/argentina-time";
import {
  normalizeOrderCutoffHourAr,
  ORDER_CUTOFF_HOUR_MAX,
  ORDER_CUTOFF_HOUR_MIN,
} from "@/lib/order-cutoff";
import {
  DEFAULT_WHATSAPP_NOTIFY_DIGITS,
  normalizeWhatsAppDigits,
} from "@/lib/whatsapp";

const SETTINGS_ID = 1;

const businessSettingsSelect = {
  whatsappNotifyPhone: true,
  orderCutoffHourAr: true,
} as const;

async function ensureBusinessSettingsRow() {
  return db.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      whatsappNotifyPhone: DEFAULT_WHATSAPP_NOTIFY_DIGITS,
      orderCutoffHourAr: ORDER_CUTOFF_HOUR_AR,
    },
    update: {},
    select: businessSettingsSelect,
  });
}

/** Ensure singleton settings row exists; return current WhatsApp notify digits. */
export async function getWhatsAppNotifyDigits(): Promise<string> {
  const row = await ensureBusinessSettingsRow();

  return (
    normalizeWhatsAppDigits(row.whatsappNotifyPhone) ??
    DEFAULT_WHATSAPP_NOTIFY_DIGITS
  );
}

/** Order batch closing hour (Argentina, 0–23). */
export async function getOrderCutoffHourAr(): Promise<number> {
  const row = await ensureBusinessSettingsRow();
  return normalizeOrderCutoffHourAr(row.orderCutoffHourAr);
}

export async function setWhatsAppNotifyPhone(phone: string): Promise<string> {
  const digits = normalizeWhatsAppDigits(phone);
  if (!digits) {
    throw new Error("INVALID_PHONE");
  }

  const row = await db.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      whatsappNotifyPhone: digits,
      orderCutoffHourAr: ORDER_CUTOFF_HOUR_AR,
    },
    update: { whatsappNotifyPhone: digits },
    select: { whatsappNotifyPhone: true },
  });

  return row.whatsappNotifyPhone;
}

export async function setOrderCutoffHourAr(hour: number): Promise<number> {
  const normalized = normalizeOrderCutoffHourAr(hour, NaN);
  if (!Number.isInteger(normalized)) {
    throw new Error("INVALID_CUTOFF_HOUR");
  }

  const row = await db.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      whatsappNotifyPhone: DEFAULT_WHATSAPP_NOTIFY_DIGITS,
      orderCutoffHourAr: normalized,
    },
    update: { orderCutoffHourAr: normalized },
    select: { orderCutoffHourAr: true },
  });

  return normalizeOrderCutoffHourAr(row.orderCutoffHourAr);
}

export { ORDER_CUTOFF_HOUR_MIN, ORDER_CUTOFF_HOUR_MAX };
