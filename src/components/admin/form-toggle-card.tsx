import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function FormToggleCard({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-lg border px-4 py-3 transition-colors",
        checked
          ? "border-[var(--brand-primary)]/35 bg-[var(--brand-primary-soft)]/40"
          : "border-neutral-200 bg-neutral-50/60 hover:border-neutral-300",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        <p className="text-xs leading-relaxed text-neutral-600">{description}</p>
      </div>
      <div className="flex shrink-0 self-center">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </label>
  );
}
