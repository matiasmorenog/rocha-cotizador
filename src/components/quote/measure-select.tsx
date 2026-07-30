"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredFloatingStyle } from "@/hooks/use-anchored-floating-style";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";

export type MeasureValue = "kg" | "unit";

const OPTIONS: { value: MeasureValue; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "unit", label: "Unidades" },
];

function indexOfValue(v: MeasureValue) {
  const i = OPTIONS.findIndex((o) => o.value === v);
  return i < 0 ? 0 : i;
}

type Props = {
  id?: string;
  value: MeasureValue;
  onChange: (value: MeasureValue) => void;
  /** Form field (h-10) vs draft row (h-8). */
  size?: "md" | "sm";
  "aria-label"?: string;
  className?: string;
};

export function MeasureSelect({
  id,
  value,
  onChange,
  size = "md",
  "aria-label": ariaLabel = "Medida",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() => indexOfValue(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const isClient = useIsClient();
  const { present, exiting, animKey } = useExitPresence(open);
  const floatingStyle = useAnchoredFloatingStyle(triggerRef, present);

  const selectedLabel =
    OPTIONS.find((o) => o.value === value)?.label ?? "Kg";
  const activeIndex = Math.max(
    0,
    Math.min(highlight, OPTIONS.length - 1),
  );

  useEffect(() => {
    if (!present) return;
    function onDocDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || floatingRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [present]);

  function openMenu(initialHighlight = indexOfValue(value)) {
    setHighlight(initialHighlight);
    setOpen(true);
  }

  function pick(next: MeasureValue) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openMenu(
          e.key === "ArrowUp" ? OPTIONS.length - 1 : indexOfValue(value),
        );
        return;
      }
      setHighlight((h) => {
        const i = Math.max(0, Math.min(h, OPTIONS.length - 1));
        if (e.key === "ArrowDown") return (i + 1) % OPTIONS.length;
        return (i - 1 + OPTIONS.length) % OPTIONS.length;
      });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      pick(OPTIONS[activeIndex].value);
      return;
    }
    if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={present ? listId : undefined}
        aria-autocomplete="none"
        aria-activedescendant={
          open ? `${listId}-opt-${activeIndex}` : undefined
        }
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex w-full items-center gap-1 rounded-md border border-neutral-300 bg-white text-left text-neutral-900",
          "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1",
          size === "sm"
            ? "h-8 pl-2 pr-1.5 text-xs"
            : "h-10 pl-3 pr-2 text-sm",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {isClient && present && floatingStyle
        ? createPortal(
            <div
              key={animKey}
              ref={floatingRef}
              style={floatingStyle}
              className={cn(
                exiting
                  ? "quote-picker-float-exit pointer-events-none"
                  : "quote-picker-float-enter",
              )}
              aria-hidden={exiting || undefined}
            >
              <ul
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                className="overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {OPTIONS.map((opt, index) => {
                  const selected = opt.value === value;
                  const active = index === activeIndex;
                  return (
                    <li key={opt.value} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-opt-${index}`}
                        role="option"
                        aria-selected={selected}
                        tabIndex={-1}
                        className={cn(
                          "flex w-full items-center px-3 text-left text-neutral-900",
                          size === "sm" ? "py-1.5 text-xs" : "py-2 text-sm",
                          active && "bg-neutral-50",
                          selected &&
                            "bg-[var(--brand-primary-soft)] font-medium text-[var(--brand-primary)]",
                          selected && active && "bg-[var(--brand-primary-soft)]",
                          !selected && "hover:bg-neutral-50",
                        )}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => pick(opt.value)}
                      >
                        {opt.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
