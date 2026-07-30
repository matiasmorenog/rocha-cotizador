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
  ARGENTINA_TZ,
  parseArgentinaDateTime,
  toArgentinaDatetimeLocal,
} from "@/lib/argentina-time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Hour-only filter value: minutes always `:00`. */
type Parts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function partsFromValue(value: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
  };
}

function toValue(p: Parts): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:00`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-based weekday index 0–6 for calendar grid. */
function mondayIndex(year: number, month: number, day: number) {
  const sun0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sun0 + 6) % 7;
}

function formatDisplay(value: string): string {
  const d = parseArgentinaDateTime(value);
  if (!d) return value;
  return d.toLocaleString("es-AR", {
    timeZone: ARGENTINA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monthTitle(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function DatetimeLocalPicker({
  value,
  onChange,
  id,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const selected = partsFromValue(value);
  const fallbackNow = (): Parts => {
    const now = partsFromValue(toArgentinaDatetimeLocal(new Date()));
    if (now) return now;
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: 1,
      hour: 0,
    };
  };
  const [viewYear, setViewYear] = useState(
    () => selected?.year ?? fallbackNow().year,
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.month ?? fallbackNow().month,
  );
  const [draft, setDraft] = useState<Parts>(() => selected ?? fallbackNow());

  function syncFromValue() {
    const next = partsFromValue(value) ?? fallbackNow();
    setDraft(next);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    syncFromValue();
    setOpen(true);
  }

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

  useEffect(() => {
    if (!open) return;
    hourListRef.current
      ?.querySelector<HTMLElement>(`[data-hour="${draft.hour}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, draft.hour]);

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
    }[] = [];
    for (let i = 0; i < start; i++) {
      const day = prevDim - start + i + 1;
      const month = viewMonth === 1 ? 12 : viewMonth - 1;
      const year = viewMonth === 1 ? viewYear - 1 : viewYear;
      out.push({ day, month, year, inMonth: false });
    }
    for (let day = 1; day <= dim; day++) {
      out.push({ day, month: viewMonth, year: viewYear, inMonth: true });
    }
    while (out.length < 42) {
      const i = out.length - (start + dim);
      const day = i + 1;
      const month = viewMonth === 12 ? 1 : viewMonth + 1;
      const year = viewMonth === 12 ? viewYear + 1 : viewYear;
      out.push({ day, month, year, inMonth: false });
    }
    return out;
  }, [viewYear, viewMonth]);

  function commit(next: Parts) {
    setDraft(next);
    onChange(toValue(next));
  }

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

  function onToday() {
    const now = partsFromValue(toArgentinaDatetimeLocal(new Date()));
    if (!now) return;
    commit(now);
    setViewYear(now.year);
    setViewMonth(now.month);
    setOpen(false);
  }

  function onClear() {
    onChange("");
    setOpen(false);
  }

  const display = value.trim() ? formatDisplay(value) : "Elegir fecha y hora";

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
          "flex h-10 w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm",
          "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value.trim() && "text-neutral-400",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <Calendar
          className="size-4 shrink-0 text-[var(--brand-primary)]"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Elegir fecha y hora"
          className="absolute left-0 z-50 mt-1 w-[min(100vw-2rem,22.5rem)] overflow-hidden rounded-lg border border-[var(--brand-latte)]/70 bg-white shadow-lg"
        >
          <div className="flex gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => shiftMonth(-1)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-neutral-700 hover:bg-[var(--brand-primary-soft)]"
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
                  className="inline-flex size-8 items-center justify-center rounded-md text-neutral-700 hover:bg-[var(--brand-primary-soft)]"
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
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell) => {
                  const isSelected =
                    draft.year === cell.year &&
                    draft.month === cell.month &&
                    draft.day === cell.day;
                  return (
                    <button
                      key={`${cell.year}-${cell.month}-${cell.day}`}
                      type="button"
                      onClick={() => {
                        commit({
                          ...draft,
                          year: cell.year,
                          month: cell.month,
                          day: cell.day,
                        });
                        if (!cell.inMonth) {
                          setViewYear(cell.year);
                          setViewMonth(cell.month);
                        }
                      }}
                      className={cn(
                        "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                        cell.inMonth
                          ? "text-neutral-900"
                          : "text-neutral-400",
                        isSelected
                          ? "bg-[var(--brand-primary)] font-medium text-white hover:bg-[var(--brand-primary)]"
                          : "hover:bg-[var(--brand-primary-soft)]",
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              ref={hourListRef}
              className="h-[14.5rem] w-[4.75rem] shrink-0 overflow-y-auto overscroll-contain border-l border-[var(--brand-latte)]/60 py-0 pl-2 pr-1 [scrollbar-gutter:stable]"
              aria-label="Hora"
            >
              {HOURS.map((h) => {
                const selectedHour = draft.hour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    data-hour={h}
                    onClick={() => commit({ ...draft, hour: h })}
                    className={cn(
                      "flex h-8 w-full items-center justify-center rounded-md text-sm tabular-nums",
                      selectedHour
                        ? "bg-[var(--brand-primary)] font-medium text-white"
                        : "text-neutral-800 hover:bg-[var(--brand-primary-soft)]",
                    )}
                  >
                    {pad2(h)}:00
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--brand-latte)]/60 bg-[var(--brand-primary-soft)]/40 px-3 py-2">
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={onToday}
              className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
