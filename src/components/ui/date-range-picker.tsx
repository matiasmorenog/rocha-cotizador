"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  defaultFilterDateRange,
  formatYmdRangeDisplay,
  lastMonthFilterDateRange,
} from "@/lib/datetime-picker-bridge";
import {
  BRAND_BORDER_ACTIVE,
  FOCUS_BRAND_BORDER,
  FOCUS_BRAND_OUTLINE,
  FOCUS_BRAND_PRIMARY,
} from "@/lib/focus-styles";
import { cn } from "@/lib/utils";
import { useExitPresence } from "@/hooks/use-exit-presence";
import { presetChipClassName } from "@/components/ui/picker-preset-chips";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

type YmdParts = { year: number; month: number; day: number };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdFromParts(p: YmdParts): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function partsFromYmd(value: string): YmdParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function mondayIndex(year: number, month: number, day: number) {
  const sun0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sun0 + 6) % 7;
}

function monthTitle(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

function isInRange(ymd: string, from: string, to: string): boolean {
  if (!from || !to) return false;
  const [start, end] =
    compareYmd(from, to) <= 0 ? [from, to] : [to, from];
  return compareYmd(ymd, start) >= 0 && compareYmd(ymd, end) <= 0;
}

function matchesPresetRange(
  from: string,
  to: string,
  preset: { from: string; to: string },
): boolean {
  const fromYmd = from.trim();
  const toYmd = to.trim();
  return (
    Boolean(fromYmd && toYmd) &&
    fromYmd === preset.from &&
    toYmd === preset.to
  );
}

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** Show "Última semana" preset chip (default true). */
  showPresets?: boolean;
};

export function DateRangePicker({
  from,
  to,
  onChange,
  id,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  showPresets = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultSeededRef = useRef(false);
  const panelId = useId();
  const { present, exiting, animKey } = useExitPresence(open);

  const anchor = partsFromYmd(draftTo || draftFrom || defaultFilterDateRange().to);
  const fallback = anchor ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 1,
  };
  const [viewYear, setViewYear] = useState(fallback.year);
  const [viewMonth, setViewMonth] = useState(fallback.month);

  function syncFromProps() {
    setDraftFrom(from);
    setDraftTo(to);
    setPendingStart(null);
    setHoverYmd(null);
    const anchorParts = partsFromYmd(to || from);
    if (anchorParts) {
      setViewYear(anchorParts.year);
      setViewMonth(anchorParts.month);
    }
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    syncFromProps();
    setOpen(true);
  }

  useEffect(() => {
    if (defaultSeededRef.current) return;
    defaultSeededRef.current = true;
    if (from.trim() || to.trim()) return;
    const { from: defaultFrom, to: defaultTo } = defaultFilterDateRange();
    onChange(defaultFrom, defaultTo);
  }, [from, to, onChange]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const dim = daysInMonth(viewYear, viewMonth);
    const start = mondayIndex(viewYear, viewMonth, 1);
    const prevDim = daysInMonth(
      viewMonth === 1 ? viewYear - 1 : viewYear,
      viewMonth === 1 ? 12 : viewMonth - 1,
    );
    const out: {
      day: number;
      month: number;
      year: number;
      inMonth: boolean;
      ymd: string;
    }[] = [];
    for (let i = 0; i < start; i++) {
      const day = prevDim - start + i + 1;
      const month = viewMonth === 1 ? 12 : viewMonth - 1;
      const year = viewMonth === 1 ? viewYear - 1 : viewYear;
      out.push({
        day,
        month,
        year,
        inMonth: false,
        ymd: ymdFromParts({ year, month, day }),
      });
    }
    for (let day = 1; day <= dim; day++) {
      out.push({
        day,
        month: viewMonth,
        year: viewYear,
        inMonth: true,
        ymd: ymdFromParts({ year: viewYear, month: viewMonth, day }),
      });
    }
    while (out.length < 42) {
      const i = out.length - (start + dim);
      const day = i + 1;
      const month = viewMonth === 12 ? 1 : viewMonth + 1;
      const year = viewMonth === 12 ? viewYear + 1 : viewYear;
      out.push({
        day,
        month,
        year,
        inMonth: false,
        ymd: ymdFromParts({ year, month, day }),
      });
    }
    return out;
  }, [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function commitRange(nextFrom: string, nextTo: string) {
    const [start, end] =
      compareYmd(nextFrom, nextTo) <= 0 ? [nextFrom, nextTo] : [nextTo, nextFrom];
    setDraftFrom(start);
    setDraftTo(end);
    onChange(start, end);
    setPendingStart(null);
    setHoverYmd(null);
  }

  function onDayClick(ymd: string, cell: { year: number; month: number; inMonth: boolean }) {
    if (!cell.inMonth) {
      setViewYear(cell.year);
      setViewMonth(cell.month);
    }

    if (!pendingStart) {
      setPendingStart(ymd);
      setDraftFrom(ymd);
      setDraftTo("");
      setHoverYmd(null);
      return;
    }

    commitRange(pendingStart, ymd);
    setHoverYmd(null);
  }

  function onLastWeek() {
    const { from: presetFrom, to: presetTo } = defaultFilterDateRange();
    commitRange(presetFrom, presetTo);
    const parts = partsFromYmd(presetTo);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }

  function onLastMonth() {
    const { from: presetFrom, to: presetTo } = lastMonthFilterDateRange();
    commitRange(presetFrom, presetTo);
    const parts = partsFromYmd(presetTo);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }

  const weekPreset = defaultFilterDateRange();
  const monthPreset = lastMonthFilterDateRange();
  const isWeekPresetActive = matchesPresetRange(from, to, weekPreset);
  const isMonthPresetActive = matchesPresetRange(from, to, monthPreset);
  const display = isWeekPresetActive
    ? "Última semana"
    : isMonthPresetActive
      ? "Último mes"
      : formatYmdRangeDisplay(from, to);
  const rangeFrom = pendingStart ?? draftFrom;
  const rangeTo = pendingStart ? (hoverYmd ?? "") : draftTo;
  const previewActive = Boolean(pendingStart && hoverYmd);
  const committedSelection =
    !pendingStart && Boolean(draftFrom.trim() && draftTo.trim());

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className={cn(
          "flex h-10 w-full min-w-[14rem] items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm",
          FOCUS_BRAND_BORDER,
          open && BRAND_BORDER_ACTIVE,
          "disabled:cursor-not-allowed disabled:opacity-50",
          !from.trim() && !to.trim() && "text-neutral-400",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <Calendar
          className="size-4 shrink-0 text-[var(--brand-primary)]"
          aria-hidden
        />
      </button>

      {present ? (
        <div
          key={animKey}
          id={panelId}
          role="dialog"
          aria-label="Elegir rango de fechas"
          aria-hidden={exiting || undefined}
          className={cn(
            "absolute left-0 z-50 mt-1 w-[min(100vw-2rem,22.5rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg",
            exiting
              ? "quote-picker-float-exit pointer-events-none"
              : "quote-picker-float-enter",
          )}
        >
          {showPresets ? (
            <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-3 py-2">
              <button
                type="button"
                onClick={onLastWeek}
                aria-pressed={isWeekPresetActive}
                className={presetChipClassName(isWeekPresetActive, "pill")}
              >
                Última semana
              </button>
              <button
                type="button"
                onClick={onLastMonth}
                aria-pressed={isMonthPresetActive}
                className={presetChipClassName(isMonthPresetActive, "pill")}
              >
                Último mes
              </button>
            </div>
          ) : null}

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => shiftMonth(-1)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-neutral-700 hover:bg-[var(--brand-primary-soft)]",
                  FOCUS_BRAND_OUTLINE,
                )}
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-medium capitalize text-neutral-900">
                {monthTitle(viewYear, viewMonth)}
              </p>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => shiftMonth(1)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md text-neutral-700 hover:bg-[var(--brand-primary-soft)]",
                  FOCUS_BRAND_OUTLINE,
                )}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-medium text-neutral-500">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div
              className="grid grid-cols-7"
              onMouseLeave={() => setHoverYmd(null)}
            >
              {cells.map((cell) => {
                const [normStart, normEnd] =
                  rangeFrom && rangeTo
                    ? compareYmd(rangeFrom, rangeTo) <= 0
                      ? [rangeFrom, rangeTo]
                      : [rangeTo, rangeFrom]
                    : [rangeFrom, rangeTo];
                const isStart = normStart === cell.ymd;
                const isEnd = Boolean(normEnd) && normEnd === cell.ymd;
                const inRange =
                  normStart &&
                  normEnd &&
                  isInRange(cell.ymd, normStart, normEnd);
                const isPending = pendingStart === cell.ymd && !hoverYmd;
                const isSameDay =
                  Boolean(normStart && normEnd) && normStart === normEnd;
                const isEndpoint = isStart || isEnd || isPending;
                const showSoftBand =
                  Boolean(normStart && normEnd) && inRange && !isSameDay;

                return (
                  <div
                    key={cell.ymd}
                    className="relative flex h-8 items-center justify-center"
                  >
                    {showSoftBand ? (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-0 h-8",
                          previewActive &&
                            "bg-[var(--brand-primary-soft)]/45 ring-1 ring-inset ring-[var(--brand-primary)]/20",
                          committedSelection &&
                            !previewActive &&
                            "bg-[var(--brand-primary-soft)]",
                          isStart && "left-1/2 right-0",
                          isEnd && "left-0 right-1/2",
                          !isStart && !isEnd && "inset-x-0",
                        )}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onDayClick(cell.ymd, cell)}
                      onMouseEnter={() => {
                        if (pendingStart) setHoverYmd(cell.ymd);
                      }}
                      className={cn(
                        "relative z-10 inline-flex size-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                        isEndpoint ? FOCUS_BRAND_PRIMARY : FOCUS_BRAND_OUTLINE,
                        cell.inMonth
                          ? "text-neutral-900"
                          : "text-neutral-400",
                        isEndpoint
                          ? cn(
                              "bg-[var(--brand-primary)] font-medium text-white hover:bg-[var(--brand-primary)]",
                              previewActive &&
                                "ring-2 ring-[var(--brand-primary)]/35 ring-offset-1",
                              committedSelection &&
                                !previewActive &&
                                "shadow-sm ring-2 ring-white/90 ring-offset-0",
                            )
                          : inRange
                            ? cn(
                                "font-medium text-neutral-900",
                                committedSelection &&
                                  !previewActive &&
                                  "text-[var(--brand-primary)]",
                              )
                            : "hover:bg-[var(--brand-primary-soft)]",
                      )}
                    >
                      {cell.day}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-neutral-200 bg-[var(--brand-primary-soft)]/40 px-3 py-2 text-center">
            <span
              className={cn(
                "text-xs",
                rangeFrom && rangeTo
                  ? "font-medium text-[var(--brand-primary)]"
                  : "text-neutral-600",
              )}
            >
              {rangeFrom && rangeTo
                ? formatYmdRangeDisplay(
                    compareYmd(rangeFrom, rangeTo) <= 0 ? rangeFrom : rangeTo,
                    compareYmd(rangeFrom, rangeTo) <= 0 ? rangeTo : rangeFrom,
                  )
                : rangeFrom
                  ? formatYmdRangeDisplay(rangeFrom, rangeFrom)
                  : "Sin rango"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { ymdToPickerValue } from "@/lib/datetime-picker-bridge";
