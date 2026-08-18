"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { DataTableScroll } from "@/components/ui/data-table";
import { DatetimeLocalPicker } from "@/components/ui/datetime-local-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import {
  argentinaYearMonth,
  formatPeriodLabel,
  type SubscriptionPaymentDto,
} from "@/lib/subscription-payments";
import { toArgentinaDatetimeLocal } from "@/lib/argentina-time";
import { cn } from "@/lib/utils";

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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const editing = useMemo(() => {
    if (!editingKey) return null;
    return payments.find((p) => `${p.periodYear}-${p.periodMonth}` === editingKey) ?? null;
  }, [payments, editingKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-600">
          Mes calendario (Argentina). Monto por defecto USD 100.
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingKey(null);
          }}
        >
          Registrar pago
        </Button>
      </div>

      {creating || editing ? (
        <PaymentForm
          key={editing ? `${editing.periodYear}-${editing.periodMonth}` : "new"}
          payment={editing ?? undefined}
          defaultYear={currentYear}
          defaultMonth={currentMonth}
          years={yearOptions(currentYear)}
          onCancel={() => {
            setCreating(false);
            setEditingKey(null);
          }}
          onSaved={(next) => {
            setPayments(next);
            setCreating(false);
            setEditingKey(null);
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
                <th className="px-3 py-2 font-medium" />
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
                    <td className="px-3 py-2">
                      <AdminTableActions className="justify-end">
                        <AdminTableIconAction
                          label="Editar"
                          icon={Pencil}
                          onClick={() => {
                            setCreating(false);
                            setEditingKey(`${p.periodYear}-${p.periodMonth}`);
                          }}
                        />
                      </AdminTableActions>
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
  payment,
  defaultYear,
  defaultMonth,
  years,
  onCancel,
  onSaved,
}: {
  payment?: SubscriptionPaymentDto;
  defaultYear: number;
  defaultMonth: number;
  years: number[];
  onCancel: () => void;
  onSaved: (payments: SubscriptionPaymentDto[]) => void;
}) {
  const [periodYear, setPeriodYear] = useState(payment?.periodYear ?? defaultYear);
  const [periodMonth, setPeriodMonth] = useState(
    payment?.periodMonth ?? defaultMonth,
  );
  const [amountUsd, setAmountUsd] = useState(String(payment?.amountUsd ?? 100));
  const [amountArs, setAmountArs] = useState(
    payment?.amountArs == null ? "" : String(payment.amountArs),
  );
  const [fxRate, setFxRate] = useState(
    payment?.fxRate == null ? "" : String(payment.fxRate),
  );
  const [paidAt, setPaidAt] = useState(
    payment?.paidAtLocal ?? toArgentinaDatetimeLocal(new Date()),
  );
  const [note, setNote] = useState(payment?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/platform/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodYear,
        periodMonth,
        amountUsd: Number(amountUsd.replace(",", ".")),
        amountArs: amountArs.trim() ? amountArs : null,
        fxRate: fxRate.trim() ? fxRate : null,
        paidAt,
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
        {payment
          ? `Editar ${payment.periodLabel}`
          : `Nuevo pago · ${formatPeriodLabel(periodYear, periodMonth)}`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pay-month">Mes</Label>
          <select
            id="pay-month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(Number(e.target.value))}
            className={selectClass}
            disabled={Boolean(payment)}
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
            disabled={Boolean(payment)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Fecha de pago</Label>
          <DatetimeLocalPicker
            value={paidAt}
            onChange={setPaidAt}
            aria-label="Fecha de pago"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pay-usd">Monto USD</Label>
          <Input
            id="pay-usd"
            inputMode="decimal"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pay-ars">Monto ARS (opcional)</Label>
          <Input
            id="pay-ars"
            inputMode="decimal"
            value={amountArs}
            onChange={(e) => setAmountArs(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="pay-fx">Tipo de cambio ARS por USD (opcional)</Label>
          <Input
            id="pay-fx"
            inputMode="decimal"
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
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
