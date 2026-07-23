"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  initialPhone: string;
};

export function WhatsAppSettingsForm({ initialPhone }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNotifyPhone: phone }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    setPhone(data.whatsappNotifyPhone ?? phone);
    setMessage("Guardado. Se normalizó a dígitos para wa.me.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="whatsapp-notify">Teléfono WhatsApp (avisos)</Label>
        <Input
          id="whatsapp-notify"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+54 9 11 6690-4442"
          autoComplete="tel"
        />
        <p className="text-xs text-neutral-500">
          Al confirmar una cotización se abre WhatsApp en este dispositivo hacia
          este número (enlace wa.me, sin API de Meta). Acepta formato con
          espacios o guiones; se guarda como dígitos.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <Button type="submit" disabled={loading || !phone.trim()}>
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
