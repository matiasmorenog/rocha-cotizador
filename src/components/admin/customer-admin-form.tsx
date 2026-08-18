"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CUSTOMER_MODULE_LABELS,
  CUSTOMER_MODULES,
  DEFAULT_CUSTOMER_MODULE_FLAGS,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { cn } from "@/lib/utils";

type PriceListOption = {
  id: string;
  name: string;
  active: boolean;
  isBase?: boolean;
};

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  nameNote: string | null;
  priceListId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  paymentTerms: string | null;
  deliveryHours: string | null;
  active: boolean;
  modules?: CustomerModuleFlags;
};

export function CustomerAdminForm({
  customer,
  priceLists,
  onCancel,
}: {
  customer?: CustomerRow;
  priceLists: PriceListOption[];
  /** Dismiss form without saving (create or edit). */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const baseListId =
    priceLists.find((l) => l.isBase)?.id ?? priceLists[0]?.id ?? "";
  const [code, setCode] = useState(customer?.code ?? "");
  const [name, setName] = useState(customer?.name ?? "");
  const [nameNote, setNameNote] = useState(customer?.nameNote ?? "");
  const [priceListId, setPriceListId] = useState(
    customer?.priceListId ?? baseListId,
  );
  const [address, setAddress] = useState(customer?.address ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [paymentTerms, setPaymentTerms] = useState(customer?.paymentTerms ?? "");
  const [deliveryHours, setDeliveryHours] = useState(customer?.deliveryHours ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [active, setActive] = useState(customer?.active ?? true);
  const [modules, setModules] = useState<CustomerModuleFlags>(
    customer?.modules ?? DEFAULT_CUSTOMER_MODULE_FLAGS,
  );
  const [resetPin, setResetPin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(customer);

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
        nameNote,
        priceListId: priceListId || baseListId || null,
        address,
        phone,
        email,
        paymentTerms,
        deliveryHours,
        notes,
        active,
        modules,
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
      setMessage(
        `Guardado. PIN inicial: ${data.pin} (el cliente debe cambiarlo por una contraseña)`,
      );
    } else {
      setMessage("Guardado");
    }
    router.refresh();
  }

  const activeLists = priceLists.filter((l) => l.active);
  const inactiveSelected =
    priceListId && !activeLists.some((l) => l.id === priceListId)
      ? priceLists.find((l) => l.id === priceListId)
      : null;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-neutral-800">
        {isEdit ? "Editar cliente" : "Nuevo cliente"}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="shrink-0 space-y-1">
          <Label htmlFor="customer-code">Código</Label>
          <Input
            id="customer-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            inputMode="numeric"
            maxLength={3}
            className="w-20 max-w-[4rem]"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="customer-name">Nombre</Label>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="customer-name-note">Aclaración</Label>
          <Input
            id="customer-name-note"
            value={nameNote}
            onChange={(e) => setNameNote(e.target.value)}
            placeholder="Opcional — ej. contacto o sucursal"
            aria-describedby="customer-name-note-hint"
          />
          <p
            id="customer-name-note-hint"
            className="text-xs text-neutral-500"
          >
            Solo visible en admin; el cliente ve únicamente el nombre.
          </p>
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
            <Label>Lista de precios</Label>
            <select
              value={priceListId}
              onChange={(e) => setPriceListId(e.target.value)}
              className={cn(
                "flex h-10 w-full rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-10 text-sm",
                FOCUS_BRAND_BORDER,
              )}
              required
            >
              {inactiveSelected ? (
                <option value={inactiveSelected.id}>
                  {inactiveSelected.name} (inactiva)
                </option>
              ) : null}
              {activeLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500">
              Precios fijos de la lista. El cliente solo ve el precio final.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Observaciones</Label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(
            "flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
            FOCUS_BRAND_BORDER,
          )}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Módulos
        </p>
        <div className="flex flex-col gap-2">
          {CUSTOMER_MODULES.map((module) => (
            <label
              key={module}
              htmlFor={`customer-module-${module}`}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
            >
              <Switch
                id={`customer-module-${module}`}
                checked={modules[module]}
                onChange={(e) =>
                  setModules((prev) => ({
                    ...prev,
                    [module]: e.target.checked,
                  }))
                }
              />
              {CUSTOMER_MODULE_LABELS[module]}
            </label>
          ))}
        </div>
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
          Regenerar PIN
        </label>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : customer ? "Actualizar cliente" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
