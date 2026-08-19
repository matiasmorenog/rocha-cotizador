"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { fetchBlueDollarRate } from "@/lib/blue-dollar";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import {
  AR_PRICE_FORMAT,
  ArNumberInput,
} from "@/components/ui/ar-number-input";
import { parseArNumber, formatArInput } from "@/lib/utils";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import {
  argentinaYearMonth,
  formatPeriodLabel,
  type SubscriptionPaymentDto,
} from "@/lib/subscription-payments";
import { cn } from "@/lib/utils";

function toArgentinaDateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}


const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const selectClass = cn(
  "flex h-10 w-full rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-10 text-sm",
  FOCUS_BRAND_BORDER,
);

function yearOptions(currentYear: number) {
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 3; y -= 1) years.push(y);
  return years;
}

export function PlatformPaymentsPanel({
  payments: initial,
}: {
  payments: SubscriptionPaymentDto[];
}) {
  const router = useRouter();
  const { year: currentYear, month: currentMonth } = argentinaYearMonth();
  const [payments, setPayments] = useState(initial);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-600">
          Mes calendario (Argentina).
        </p>
        <Button
          type="button"
          onClick={() => setCreating(true)}
        >
          Registrar pago
        </Button>
      </div>

      {creating ? (
        <PaymentForm
          defaultYear={currentYear}
          defaultMonth={currentMonth}
          years={yearOptions(currentYear)}
          onCancel={() => setCreating(false)}
          onSaved={(next) => {
            setPayments(next);
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}

      {payments.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay pagos registrados.</p>
      ) : (
        <DataTableScroll>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Período</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">USD</th>
                <th className="px-3 py-2 font-medium">ARS</th>
                <th className="px-3 py-2 font-medium">Tipo de cambio</th>
                <th className="px-3 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const paid = Boolean(p.paidAt);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-3 py-2">{p.periodLabel}</td>
                    <td className="px-3 py-2">{paid ? "Pagado" : "Pendiente"}</td>
                    <td className="px-3 py-2">{p.paidAtLabel ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.amountUsd.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.amountArs == null
                        ? "—"
                        : p.amountArs.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.fxRate == null
                        ? "—"
                        : p.fxRate.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-neutral-600">
                      {p.note ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableScroll>
      )}
    </div>
  );
}

function PaymentForm({
  defaultYear,
  defaultMonth,
  years,
  onCancel,
  onSaved,
}: {
  defaultYear: number;
  defaultMonth: number;
  years: number[];
  onCancel: () => void;
  onSaved: (payments: SubscriptionPaymentDto[]) => void;
}) {
  const [periodYear, setPeriodYear] = useState(defaultYear);
  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [amountUsd, setAmountUsd] = useState(formatArInput(100, 2, AR_PRICE_FORMAT));
  const [fxRate, setFxRate] = useState("");
  const [fxRateLoading, setFxRateLoading] = useState(true);
  const [fxRateError, setFxRateError] = useState(false);

  useEffect(() => {
    fetchBlueDollarRate().then((rate) => {
      setFxRateLoading(false);
      if (rate == null) {
        setFxRateError(true);
      } else {
        setFxRate(formatArInput(rate, 2));
      }
    });
  }, []);

  const [paidAt, setPaidAt] = useState(toArgentinaDateOnly(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/platform/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodYear,
        periodMonth,
        amountUsd: parseArNumber(amountUsd),
        fxRate: fxRate.trim() ? parseArNumber(fxRate) : null,
        paidAt: paidAt ? `${paidAt}T00:00` : paidAt,
        note: note.trim() || null,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    onSaved(data.payments as SubscriptionPaymentDto[]);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-neutral-800">
        {`Nuevo pago · ${formatPeriodLabel(periodYear, periodMonth)}`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pay-month">Mes</Label>
          <select
            id="pay-month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(Number(e.target.value))}
            className={selectClass}
          >
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pay-year">Año</Label>
          <select
            id="pay-year"
            value={periodYear}
            onChange={(e) => setPeriodYear(Number(e.target.value))}
            className={selectClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pay-date">Fecha de pago</Label>
          <DatetimeLocalPicker
            id="pay-date"
            dateOnly
            value={paidAt}
            onChange={setPaidAt}
            aria-label="Fecha de pago"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pay-usd">Monto USD</Label>
          <ArNumberInput
            id="pay-usd"
            value={amountUsd}
            onValueChange={setAmountUsd}
            maxFractionDigits={2}
            formatOptions={AR_PRICE_FORMAT}
            placeholder="100,00"
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pay-fx" className="flex items-center gap-1">
            Tipo de cambio ARS por USD
            <Lock className="h-3 w-3 text-neutral-400" />
          </Label>
          <ArNumberInput
            id="pay-fx"
            value={fxRateLoading ? "" : fxRate}
            onValueChange={() => {}}
            maxFractionDigits={2}
            placeholder={
              fxRateLoading
                ? "Cargando…"
                : fxRateError
                  ? "No disponible"
                  : undefined
            }
            disabled
            className="pr-8 disabled:cursor-default disabled:opacity-100 bg-neutral-50"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pay-note">Nota (opcional)</Label>
          <textarea
            id="pay-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={cn(
              "flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
              FOCUS_BRAND_BORDER,
            )}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
