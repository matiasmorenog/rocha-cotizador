"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  BRAND_BORDER_ACTIVE,
  FOCUS_BRAND_BORDER,
} from "@/lib/focus-styles";
import { foldSearchText } from "@/lib/search-fold";
import { cn } from "@/lib/utils";
import { useAnchoredFloatingStyle } from "@/hooks/use-anchored-floating-style";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { useIsClient } from "@/hooks/use-is-client";
import { useSmoothListHeight } from "@/hooks/use-smooth-list-height";

export type AppSelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
  /** Consecutive options with the same group render a section header. */
  group?: string;
};

export type AppSelectProps<T extends string = string> = {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly AppSelectOption<T>[];
  size?: "md" | "sm";
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  /** Native form association (hidden input). */
  name?: string;
  form?: string;
  "aria-label"?: string;
  className?: string;
  /** Extra classes on the trigger (e.g. amber preview chrome). */
  triggerClassName?: string;
  /**
   * Type-to-filter in the trigger itself (folded label match).
   * Use for long lists (Tipo, sucursales…).
   */
  searchable?: boolean;
  searchPlaceholder?: string;
};

type FlatRow<T extends string> =
  | { kind: "group"; label: string; key: string }
  | { kind: "option"; option: AppSelectOption<T>; optionIndex: number };

function buildFlatRows<T extends string>(
  options: readonly AppSelectOption<T>[],
): FlatRow<T>[] {
  const rows: FlatRow<T>[] = [];
  let lastGroup: string | undefined;
  options.forEach((option, optionIndex) => {
    const group = option.group?.trim();
    if (group && group !== lastGroup) {
      rows.push({ kind: "group", label: group, key: `g-${group}-${optionIndex}` });
      lastGroup = group;
    }
    if (!group) lastGroup = undefined;
    rows.push({ kind: "option", option, optionIndex });
  });
  return rows;
}

function filterOptions<T extends string>(
  options: readonly AppSelectOption<T>[],
  query: string,
): AppSelectOption<T>[] {
  const needle = foldSearchText(query.trim());
  if (!needle) return [...options];
  return options.filter((option) =>
    foldSearchText(option.label).includes(needle),
  );
}

/**
 * App-styled select (portal listbox + float enter/exit).
 * Prefer this over native `<select>` for consistent Rocha chrome.
 */
export function AppSelect<T extends string = string>({
  id,
  value,
  onChange,
  options,
  size = "md",
  disabled = false,
  required = false,
  placeholder = "Elegir…",
  name,
  form,
  "aria-label": ariaLabel,
  className,
  triggerClassName,
  searchable = false,
  searchPlaceholder = "Buscar…",
}: AppSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(
    () => (searchable ? filterOptions(options, query) : [...options]),
    [options, query, searchable],
  );
  const selectedInVisible = visibleOptions.findIndex((o) => o.value === value);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const listShellRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const isClient = useIsClient();
  const { present, exiting, animKey } = useExitPresence(open);
  const floatingStyle = useAnchoredFloatingStyle(anchorRef, present);
  const listResizeKey = useMemo(
    () =>
      visibleOptions.length === 0
        ? "empty"
        : visibleOptions.map((o) => o.value).join("\0"),
    [visibleOptions],
  );
  useSmoothListHeight(
    listShellRef,
    listResizeKey,
    searchable && present && !exiting,
  );

  const flatRows = useMemo(
    () => buildFlatRows(visibleOptions),
    [visibleOptions],
  );
  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? placeholder;
  const activeIndex = Math.max(
    0,
    Math.min(highlight, Math.max(0, visibleOptions.length - 1)),
  );

  const triggerChrome = cn(
    "flex w-full items-center gap-1 rounded-md border border-neutral-300 bg-white text-left text-neutral-900",
    FOCUS_BRAND_BORDER,
    open && BRAND_BORDER_ACTIVE,
    size === "sm" ? "h-8 pl-2 pr-1.5 text-xs" : "h-10 pl-3 pr-2 text-sm",
    disabled && "cursor-not-allowed opacity-50",
    triggerClassName,
  );

  useEffect(() => {
    if (!present) return;
    function onDocDown(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || floatingRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [present]);

  useEffect(() => {
    if (!present || exiting || !searchable) return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [present, exiting, searchable, animKey]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  function openMenu(initialQuery = "") {
    if (disabled || options.length === 0) return;
    // Open with empty (or typed) filter — keep `value` until pick / dismiss.
    setQuery(initialQuery);
    const nextVisible = searchable
      ? filterOptions(options, initialQuery)
      : options;
    const selectedIdx = nextVisible.findIndex((o) => o.value === value);
    setHighlight(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }

  function pick(next: T) {
    onChange(next);
    closeMenu();
    if (searchable) searchRef.current?.focus();
    else triggerRef.current?.focus();
  }

  function moveHighlight(delta: number) {
    if (visibleOptions.length === 0) return;
    setHighlight((h) => {
      let i = Math.max(0, Math.min(h, visibleOptions.length - 1));
      for (let step = 0; step < visibleOptions.length; step += 1) {
        i = (i + delta + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[i]?.disabled) return i;
      }
      return h;
    });
  }

  function onComboboxKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      moveHighlight(e.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const opt = visibleOptions[activeIndex];
      if (opt && !opt.disabled) pick(opt.value);
      return;
    }
    if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      if (searchable && query) {
        setQuery("");
        setHighlight(selectedInVisible >= 0 ? selectedInVisible : 0);
        return;
      }
      closeMenu();
      return;
    }
    if (e.key === " " && !searchable) {
      e.preventDefault();
      if (!open) openMenu();
      else {
        const opt = visibleOptions[activeIndex];
        if (opt && !opt.disabled) pick(opt.value);
      }
      return;
    }
    // Closed searchable: first printable key opens + starts filter.
    if (
      searchable &&
      !open &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      openMenu(e.key);
    }
  }

  function onQueryChange(next: string) {
    if (!open) return;
    setQuery(next);
    const nextVisible = filterOptions(options, next);
    const selectedIdx = nextVisible.findIndex((o) => o.value === value);
    setHighlight(selectedIdx >= 0 ? selectedIdx : 0);
  }

  const listbox = isClient && present && floatingStyle
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
          <div
            ref={listShellRef}
            className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
          >
            <ul
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className="max-h-64 overflow-y-auto overflow-x-hidden"
            >
              {visibleOptions.length === 0 ? (
                <li
                  role="presentation"
                  className="px-3 py-2 text-sm text-neutral-500"
                >
                  Sin coincidencias
                </li>
              ) : (
                flatRows.map((row, rowIndex) => {
                  if (row.kind === "group") {
                    return (
                      <li
                        key={row.key}
                        role="presentation"
                        className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                      >
                        {row.label}
                      </li>
                    );
                  }
                  const { option, optionIndex } = row;
                  const selectedOpt = option.value === value;
                  const active = optionIndex === activeIndex;
                  const isFirst = rowIndex === 0;
                  const isLast = rowIndex === flatRows.length - 1;
                  return (
                    <li
                      key={`${option.value}-${optionIndex}`}
                      role="presentation"
                    >
                      <button
                        type="button"
                        id={`${listId}-opt-${optionIndex}`}
                        role="option"
                        aria-selected={selectedOpt}
                        aria-disabled={option.disabled || undefined}
                        tabIndex={-1}
                        disabled={option.disabled}
                        className={cn(
                          "flex w-full items-center px-3 text-left text-sm",
                          size === "sm" ? "py-1.5 text-xs" : "py-2",
                          isFirst && "rounded-t-md",
                          isLast && "rounded-b-md",
                          option.disabled && "cursor-not-allowed opacity-40",
                          !option.disabled &&
                            (active
                              ? "bg-[var(--brand-primary-soft)]"
                              : "hover:bg-neutral-50"),
                        )}
                        onMouseEnter={() => {
                          if (!option.disabled) setHighlight(optionIndex);
                        }}
                        onClick={() => {
                          if (!option.disabled) pick(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? (
        <input
          type="hidden"
          name={name}
          form={form}
          value={value}
          required={required}
          disabled={disabled}
        />
      ) : null}

      {searchable ? (
        <div ref={anchorRef} className={triggerChrome}>
          <input
            ref={searchRef}
            id={id}
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={present ? listId : undefined}
            aria-autocomplete="list"
            aria-required={required || undefined}
            aria-activedescendant={
              open && visibleOptions.length > 0
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
            disabled={disabled}
            readOnly={!open}
            value={open ? query : selectedLabel}
            placeholder={open ? searchPlaceholder : placeholder}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              if (!open && !disabled) openMenu();
            }}
            onClick={() => {
              if (!open && !disabled) openMenu();
            }}
            onKeyDown={onComboboxKeyDown}
            className={cn(
              "min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400",
              !selected && !open && "text-neutral-500",
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label={open ? "Cerrar lista" : "Abrir lista"}
            className="shrink-0 rounded-sm text-neutral-500"
            onMouseDown={(e) => {
              // Keep input focus; toggle list without blur race.
              e.preventDefault();
            }}
            onClick={() => {
              if (open) closeMenu();
              else openMenu();
              searchRef.current?.focus();
            }}
          >
            <ChevronDown
              className={cn(
                "transition-transform duration-200 motion-reduce:transition-none",
                size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
      ) : (
        <div ref={anchorRef}>
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
            aria-required={required || undefined}
            aria-activedescendant={
              open && visibleOptions.length > 0
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
            disabled={disabled}
            onClick={() => {
              if (open) closeMenu();
              else openMenu();
            }}
            onKeyDown={onComboboxKeyDown}
            className={cn(triggerChrome, !selected && "text-neutral-500")}
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
        </div>
      )}

      {listbox}
    </div>
  );
}
