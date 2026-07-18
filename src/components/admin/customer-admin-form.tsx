"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  discountPercent: string | number;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  paymentTerms: string | null;
  deliveryHours: string | null;
  active: boolean;
};

export function CustomerAdminForm({ customer }: { customer?: CustomerRow }) {
  const router = useRouter();
  const [code, setCode] = useState(customer?.code ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [discountPercent, setDiscount] = useState(
    String(customer?.discountPercent ?? "0"),
  );
  const [address, setAddress] = useState(customer?.address ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [paymentTerms, setPaymentTerms] = useState(customer?.paymentTerms ?? "");
  const [deliveryHours, setDeliveryHours] = useState(customer?.deliveryHours ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [active, setActive] = useState(customer?.active ?? true);
  const [resetPin, setResetPin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer?.id,
        code,
        name,
        discountPercent: Number(discountPercent),
        address,
        phone,
        email,
        paymentTerms,
        deliveryHours,
        notes,
        active,
        resetPin: customer ? resetPin : true,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    if (data.pin) {
      setMessage(`Guardado. PIN inicial: ${data.pin} (el cliente debe cambiarlo por una contraseña)`);
    } else {
      setMessage("Guardado");
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Código</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Contacto
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Entrega y precio
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Dirección</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Forma de pago</Label>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ej. CC / Mensual / Efectivo"
              />
            </div>
            <div className="space-y-1">
              <Label>Hs. entrega</Label>
              <Input
                value={deliveryHours}
                onChange={(e) => setDeliveryHours(e.target.value)}
                placeholder="Ej. 8:00 hs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descuento % (oculto al cliente)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountPercent}
              onChange={(e) => setDiscount(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notas</Label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <label
        htmlFor="customer-active"
        className="flex cursor-pointer items-center gap-2.5 text-sm"
      >
        <Switch
          id="customer-active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Activo
      </label>
      {customer ? (
        <label
          htmlFor="customer-reset-pin"
          className="flex cursor-pointer items-center gap-2.5 text-sm"
        >
          <Switch
            id="customer-reset-pin"
            checked={resetPin}
            onChange={(e) => setResetPin(e.target.checked)}
          />
          Resetear a PIN inicial (el cliente deberá cambiarlo)
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : customer ? "Actualizar" : "Crear cliente"}
      </Button>
    </form>
  );
}
