import { db } from "@/lib/db";
import {
  DEFAULT_WHATSAPP_NOTIFY_DIGITS,
  normalizeWhatsAppDigits,
} from "@/lib/whatsapp";

const SETTINGS_ID = 1;

/** Ensure singleton settings row exists; return current WhatsApp notify digits. */
export async function getWhatsAppNotifyDigits(): Promise<string> {
  const row = await db.businessSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      whatsappNotifyPhone: DEFAULT_WHATSAPP_NOTIFY_DIGITS,
    },
    update: {},
    select: { whatsappNotifyPhone: true },
  });

  return (
    normalizeWhatsAppDigits(row.whatsappNotifyPhone) ??
    DEFAULT_WHATSAPP_NOTIFY_DIGITS
  );
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
    },
    update: { whatsappNotifyPhone: digits },
    select: { whatsappNotifyPhone: true },
  });

  return row.whatsappNotifyPhone;
}
