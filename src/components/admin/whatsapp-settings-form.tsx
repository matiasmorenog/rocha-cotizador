"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  formatWhatsAppLocalDisplay,
  maskWhatsAppLocalInput,
} from "@/lib/whatsapp";

type Props = {
  /** Digits or any stored phone; shown as local AR format after fixed +54. */
  initialPhone: string;
};

export function WhatsAppSettingsForm({ initialPhone }: Props) {
  const router = useRouter();
  const [localPhone, setLocalPhone] = useState(() =>
    formatWhatsAppLocalDisplay(initialPhone),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Fixed +54 for Argentina — API normalizes to wa.me digits.
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNotifyPhone: `+54 ${localPhone}` }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    const saved = String(data.whatsappNotifyPhone ?? "");
    setLocalPhone(formatWhatsAppLocalDisplay(saved));
    setMessage("Guardado.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="whatsapp-notify">Teléfono WhatsApp (notificaciones)</Label>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-10 shrink-0 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-700"
            aria-hidden
          >
            +54
          </span>
          <Input
            id="whatsapp-notify"
            value={localPhone}
            onChange={(e) => setLocalPhone(maskWhatsAppLocalInput(e.target.value))}
            placeholder="9 11-6690-4442"
            inputMode="tel"
            autoComplete="tel-national"
            className="font-mono tracking-wide"
            aria-describedby="whatsapp-notify-hint"
          />
        </div>
        <p id="whatsapp-notify-hint" className="text-xs text-neutral-500">
          Código de país fijo (+54, solo Argentina). Escribí el móvil con el 9,
          ej. <span className="font-mono">9 11-6690-4442</span>. Al confirmar
          una cotización se abre WhatsApp (wa.me) hacia este número.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <Button type="submit" disabled={loading || !localPhone.trim()}>
        {loading ? (
          <>
            <Spinner className="mr-2 text-white" />
            Guardando…
          </>
        ) : (
          "Guardar"
        )}
      </Button>
    </form>
  );
}
