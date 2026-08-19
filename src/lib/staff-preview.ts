import {
  permissionsForStaff,
  type StaffCapabilityProfile,
} from "@/lib/staff-permissions";
/** JWT/session preset ids — superuser-only staff preview. */
export type StaffPreviewPresetId =
  | "full_admin"
  | "quotes_only"
  | "stock_only"
  | "quotes_and_stock";

export type StaffPreviewSession = {
  presetId: StaffPreviewPresetId;
  label: string;
};

const PRESET_PROFILES: Record<
  StaffPreviewPresetId,
  { label: string; profile: StaffCapabilityProfile }
> = {
  full_admin: {
    label: "Administración",
    profile: { role: "ADMIN", canQuotes: true, canStock: true },
  },
  quotes_only: {
    label: "Cotización",
    profile: { role: "QUOTES", canQuotes: true, canStock: false },
  },
  stock_only: {
    label: "Stock",
    profile: { role: "STOCK", canQuotes: false, canStock: true },
  },
  quotes_and_stock: {
    label: "Cotización + Stock",
    profile: { role: "QUOTES", canQuotes: true, canStock: true },
  },
};

export const STAFF_PREVIEW_PRESET_ORDER: StaffPreviewPresetId[] = [
  "full_admin",
  "quotes_only",
  "stock_only",
  "quotes_and_stock",
];

export function staffPreviewPresetLabel(id: StaffPreviewPresetId): string {
  return PRESET_PROFILES[id].label;
}

export function staffPreviewProfile(
  id: StaffPreviewPresetId,
): StaffCapabilityProfile {
  return PRESET_PROFILES[id].profile;
}

export function staffPreviewPermissions(id: StaffPreviewPresetId) {
  return permissionsForStaff(PRESET_PROFILES[id].profile);
}

export function parseStaffPreviewPresetId(
  value: unknown,
): StaffPreviewPresetId | null {
  if (typeof value !== "string") return null;
  if (value in PRESET_PROFILES) return value as StaffPreviewPresetId;
  return null;
}

export function staffPreviewSessionFromPresetId(
  id: StaffPreviewPresetId,
): StaffPreviewSession {
  return { presetId: id, label: PRESET_PROFILES[id].label };
}
