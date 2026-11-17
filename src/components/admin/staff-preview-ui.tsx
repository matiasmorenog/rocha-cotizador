"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTransition } from "react";
import { Eye } from "lucide-react";
import { AppSelect } from "@/components/ui/app-select";
import {
  STAFF_PREVIEW_PRESET_ORDER,
  staffPreviewPresetLabel,
  type StaffPreviewPresetId,
} from "@/lib/staff-preview";
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
        "flex w-full min-w-0 flex-col gap-1.5 text-xs text-neutral-600",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 shrink-0 text-current" aria-hidden />
        Ver como
      </span>
      <AppSelect
        aria-label="Vista previa de permisos de staff"
        disabled={pending}
        value={activePreset}
        onChange={onChange}
        size="sm"
        triggerClassName={
          isPreviewActive
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : undefined
        }
        options={[
          { value: "", label: "Superusuario" },
          ...STAFF_PREVIEW_PRESET_ORDER.map((id) => ({
            value: id,
            label: staffPreviewPresetLabel(id),
          })),
        ]}
      />
    </label>
  );
}
