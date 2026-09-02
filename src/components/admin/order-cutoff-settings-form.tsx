"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  formatOrderCutoffHourLabel,
  ORDER_CUTOFF_HOUR_MAX,
  ORDER_CUTOFF_HOUR_MIN,
} from "@/lib/order-cutoff";

type Props = {
  initialHour: number;
};

export function OrderCutoffSettingsForm({ initialHour }: Props) {
  const router = useRouter();
  const [hour, setHour] = useState(String(initialHour));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const parsed = Number(hour);
    if (
      !Number.isInteger(parsed) ||
      parsed < ORDER_CUTOFF_HOUR_MIN ||
      parsed > ORDER_CUTOFF_HOUR_MAX
    ) {
      setLoading(false);
      setError(
        `Ingresá una hora entre ${ORDER_CUTOFF_HOUR_MIN} y ${ORDER_CUTOFF_HOUR_MAX}.`,
      );
      return;
    }

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCutoffHourAr: parsed }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    const saved = Number(data.orderCutoffHourAr ?? parsed);
    setHour(String(saved));
    setMessage("Guardado.");
    router.refresh();
  }

  const previewHour = Number(hour);
  const previewLabel = Number.isInteger(previewHour)
    ? formatOrderCutoffHourLabel(previewHour)
    : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="order-cutoff-hour">Hora de cierre de pedidos</Label>
        <div className="flex max-w-xs items-center gap-2">
          <Input
            id="order-cutoff-hour"
            type="number"
            min={ORDER_CUTOFF_HOUR_MIN}
            max={ORDER_CUTOFF_HOUR_MAX}
            step={1}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="font-mono tabular-nums"
            aria-describedby="order-cutoff-hour-hint"
          />
          <span className="shrink-0 text-sm text-neutral-600">:00 AR</span>
        </div>
        <p id="order-cutoff-hour-hint" className="text-xs text-neutral-500">
          Horario Argentina. Pedidos antes de las{" "}
          {previewLabel ?? "—"} se preparan para el día siguiente; después del
          corte, el mínimo de entrega pasa a ser pasado mañana. También define
          el grupo &quot;después del cierre&quot; en el listado de cotizaciones.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !hour.trim()}>
          {loading ? (
            <>
              <Spinner className="mr-2 text-white" />
              Guardando…
            </>
          ) : (
            "Guardar"
          )}
        </Button>
      </div>
    </form>
  );
}
