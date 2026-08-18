"use client";

import { useMemo, useState } from "react";
import type { StockSummaryDailyPoint } from "@/lib/admin-stock-summary-shared";
import { cn, formatQty } from "@/lib/utils";

type PlotPoint = {
  x: number;
  y: number;
  point: StockSummaryDailyPoint;
};

const PLOT = {
  top: 22,
  bottom: 8,
  height: 100,
  width: 100,
} as const;

const HORIZONTAL_INSET = 2.5;
const SERIES_STROKE = 2.5;
const TOOLTIP_FLIP_THRESHOLD = 28;

function bucketX(index: number, count: number): number {
  if (count === 1) return PLOT.width / 2;
  const span = PLOT.width - HORIZONTAL_INSET * 2;
  return HORIZONTAL_INSET + (index / (count - 1)) * span;
}

function buildPlotPoints(
  data: StockSummaryDailyPoint[],
  maxTotal: number,
): PlotPoint[] {
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom;
  return data.map((point, index) => ({
    x: bucketX(index, data.length),
    y:
      PLOT.top +
      plotHeight -
      (point.totalQty / maxTotal) * plotHeight,
    point,
  }));
}

function ChartTooltip({
  plot,
  showBelow,
}: {
  plot: PlotPoint;
  showBelow: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 w-max max-w-[9.5rem] -translate-x-1/2 rounded-lg border border-neutral-200/80 bg-white px-3 py-2 text-center shadow-md",
        showBelow ? "translate-y-2" : "-translate-y-full -mt-2",
      )}
      style={{
        left: `${plot.x}%`,
        top: `${plot.y}%`,
      }}
    >
      <p className="text-xs font-semibold text-neutral-900">
        {formatQty(plot.point.totalQty)} u.
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
        {plot.point.label}
      </p>
    </div>
  );
}

function DailyLineSvg({ plotPoints }: { plotPoints: PlotPoint[] }) {
  const plotHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const bottomY = PLOT.top + plotHeight;

  const linePath = plotPoints
    .map((plot, index) => `${index === 0 ? "M" : "L"} ${plot.x} ${plot.y}`)
    .join(" ");

  const first = plotPoints[0];
  const last = plotPoints[plotPoints.length - 1];
  const areaPath =
    plotPoints.length === 0
      ? ""
      : [
          linePath,
          `L ${last.x} ${bottomY}`,
          `L ${first.x} ${bottomY}`,
          "Z",
        ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id="stock-daily-area" x1="0" x2="0" y1="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--brand-primary)"
            stopOpacity="0.18"
          />
          <stop
            offset="100%"
            stopColor="var(--brand-primary)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = PLOT.top + plotHeight * (1 - ratio);
        return (
          <line
            key={ratio}
            x1={0}
            x2={PLOT.width}
            y1={y}
            y2={y}
            className="stroke-neutral-100"
            strokeWidth={0.4}
          />
        );
      })}

      {linePath ? (
        <g>
          <path d={areaPath} fill="url(#stock-daily-area)" />
          <path
            d={linePath}
            fill="none"
            className="stroke-[var(--brand-primary)]"
            strokeWidth={SERIES_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : null}
    </svg>
  );
}

export function AdminStockSummaryChart({
  daily,
  emptyLabel = "Sin cargas en el período.",
}: {
  daily: StockSummaryDailyPoint[];
  emptyLabel?: string;
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const maxTotal = Math.max(...daily.map((point) => point.totalQty), 1);
  const hasData = daily.some((point) => point.totalQty > 0);
  const plotPoints = useMemo(
    () => buildPlotPoints(daily, maxTotal),
    [daily, maxTotal],
  );

  const activePlot =
    plotPoints.find((plot) => plot.point.date === activeDate) ?? null;
  const showTooltipBelow = activePlot
    ? activePlot.y < TOOLTIP_FLIP_THRESHOLD
    : false;

  const labelStride = daily.length > 14 ? Math.ceil(daily.length / 7) : 1;

  if (!hasData) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-400">
        Totales diarios en el período. Pasá el mouse para detalles.
      </p>
      <div
        className={cn(
          daily.length > 14 && "-mx-1 overflow-x-auto overflow-y-visible px-1 pb-1 sm:-mx-2 sm:px-2",
        )}
      >
        <div className={cn(daily.length > 14 ? "min-w-[28rem]" : "w-full")}>
          <div className="relative h-44 overflow-visible sm:h-48">
            <DailyLineSvg plotPoints={plotPoints} />

            {plotPoints.map((plot) => {
              const isActive = activeDate === plot.point.date;
              return (
                <button
                  key={plot.point.date}
                  type="button"
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-manipulation"
                  style={{
                    left: `${plot.x}%`,
                    top: `${plot.y}%`,
                  }}
                  onMouseEnter={() => setActiveDate(plot.point.date)}
                  onMouseLeave={() => setActiveDate(null)}
                  aria-label={`${plot.point.label}: ${formatQty(plot.point.totalQty)} unidades`}
                >
                  <span
                    className={cn(
                      "block size-3.5 rounded-full border-[var(--brand-primary)] bg-white transition-transform",
                      isActive && "size-[17px] shadow-sm",
                    )}
                    style={{ borderWidth: SERIES_STROKE }}
                  />
                </button>
              );
            })}

            {activePlot && activePlot.point.totalQty > 0 ? (
              <ChartTooltip
                plot={activePlot}
                showBelow={showTooltipBelow}
              />
            ) : null}
          </div>

          <div className="relative mt-2 h-5 w-full">
            {plotPoints.map((plot, index) =>
              index % labelStride === 0 || index === plotPoints.length - 1 ? (
                <span
                  key={plot.point.date}
                  className={cn(
                    "absolute max-w-[3.5rem] -translate-x-1/2 truncate text-center text-[11px] capitalize text-neutral-500",
                    activeDate === plot.point.date &&
                      "font-semibold text-[var(--brand-primary)]",
                  )}
                  style={{ left: `${plot.x}%` }}
                >
                  {plot.point.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
