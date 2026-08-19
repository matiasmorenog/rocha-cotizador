"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTransition } from "react";
import { Eye, X } from "lucide-react";
import {
  STAFF_PREVIEW_PRESET_ORDER,
  staffPreviewPresetLabel,
  type StaffPreviewPresetId,
} from "@/lib/staff-preview";
import { FOCUS_BRAND_BORDER, FOCUS_BRAND_OUTLINE } from "@/lib/focus-styles";
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
      className={cn("flex items-center gap-2 text-xs text-neutral-600", className)}
    >
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Ver como</span>
      <select
        aria-label="Vista previa de permisos de staff"
        disabled={pending}
        value={activePreset}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 max-w-[10.5rem] truncate rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-800",
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

export function StaffPreviewBanner({ label }: { label: string }) {
  const { update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onReset() {
    startTransition(async () => {
      await setStaffPreview(update, null);
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 print:hidden"
    >
      <p>
        <span className="font-medium">Vista previa:</span> {label}. Los permisos
        de staff aplican; las rutas de superusuario están bloqueadas.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={onReset}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100/80",
          FOCUS_BRAND_OUTLINE,
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Salir de vista previa
      </button>
    </div>
  );
}
