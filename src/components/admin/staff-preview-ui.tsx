"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTransition } from "react";
import { Eye } from "lucide-react";
import {
  STAFF_PREVIEW_PRESET_ORDER,
  staffPreviewPresetLabel,
  type StaffPreviewPresetId,
} from "@/lib/staff-preview";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

async function setStaffPreview(
  update: ReturnType<typeof useSession>["update"],
  preset: StaffPreviewPresetId | null,
) {
  await update({ staffPreview: preset });
}

export function StaffPreviewControl({
  className,
  isSuperuser: isSuperuserProp,
}: {
  className?: string;
  /** Server session — avoids hiding until client SessionProvider hydrates. */
  isSuperuser?: boolean;
}) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isSuperuser =
    isSuperuserProp ?? Boolean(session?.user?.isSuperuser);
  if (!isSuperuser) return null;

  const activePreset = session?.user?.staffPreview?.presetId ?? "";
  const isPreviewActive = activePreset !== "";

  function onChange(value: string) {
    startTransition(async () => {
      const preset =
        value === "" ? null : (value as StaffPreviewPresetId);
      await setStaffPreview(update, preset);
      router.refresh();
    });
  }

  return (
    <label
      className={cn(
        "flex items-center gap-2 text-xs text-neutral-600",
        className,
      )}
    >
      <Eye className="h-3.5 w-3.5 shrink-0 text-current" aria-hidden />
      <span className="hidden sm:inline">Ver como</span>
      <select
        aria-label="Vista previa de permisos de staff"
        disabled={pending}
        value={activePreset}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 max-w-[10.5rem] truncate rounded-md border px-2 text-xs",
          isPreviewActive
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-neutral-200 bg-white text-neutral-800",
          FOCUS_BRAND_BORDER,
        )}
      >
        <option value="">Superusuario</option>
        {STAFF_PREVIEW_PRESET_ORDER.map((id) => (
          <option key={id} value={id}>
            {staffPreviewPresetLabel(id)}
          </option>
        ))}
      </select>
    </label>
  );
}
