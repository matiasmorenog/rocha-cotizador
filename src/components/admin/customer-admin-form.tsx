"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSection } from "@/components/admin/form-section";
import { FormToggleCard } from "@/components/admin/form-toggle-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOMER_ACCOUNT_STATUS_LABELS,
  CUSTOMER_MODULE_DESCRIPTIONS,
  CUSTOMER_MODULE_LABELS,
  CUSTOMER_MODULES,
  DEFAULT_CUSTOMER_MODULE_FLAGS,
  type CustomerModuleFlags,
} from "@/lib/customer-modules";
import { FOCUS_BRAND_BORDER } from "@/lib/focus-styles";
import { dispatchAdminInAppToast } from "@/lib/push-sw-client";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(customer);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : `No se pudo guardar el cliente (HTTP ${res.status}).`;
        setError(detail);
        dispatchAdminInAppToast({
          title: "Error al guardar cliente",
          body: detail,
          tone: "error",
        });
        return;
      }

      const savedLabel = `${name.trim()} (${code.trim()})`;
      if (data.pin) {
        const detail = `PIN inicial: ${data.pin}. El cliente debe cambiarlo por una contraseña.`;
        dispatchAdminInAppToast({
          title: "Cliente creado",
          body: `${savedLabel}. ${detail}`,
          tone: "success",
        });
      } else {
        dispatchAdminInAppToast({
          title: isEdit ? "Cliente actualizado" : "Cliente creado",
          body: savedLabel,
          tone: "success",
        });
      }
      router.refresh();
      onCancel?.();
    } catch {
      const detail = "No se pudo conectar con el servidor. Revisá tu conexión.";
      setError(detail);
      dispatchAdminInAppToast({
        title: "Error al guardar cliente",
        body: detail,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const activeLists = priceLists.filter((l) => l.active);
  const inactiveSelected =
    priceListId && !activeLists.some((l) => l.id === priceListId)
      ? priceLists.find((l) => l.id === priceListId)
      : null;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-medium text-neutral-800">
        {isEdit ? "Editar cliente" : "Nuevo cliente"}
      </p>

      <FormSection
        title="Identificación"
        description="Código de ingreso y nombre que ve el cliente al cotizar."
      >
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
      </FormSection>

      <FormSection title="Contacto">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="customer-phone">Teléfono</Label>
            <Input
              id="customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Entrega y precio"
        description="Datos operativos y lista de precios asignada al cliente."
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="customer-address">Dirección</Label>
            <Input
              id="customer-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="customer-payment-terms">Forma de pago</Label>
              <Input
                id="customer-payment-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ej. CC / Mensual / Efectivo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-delivery-hours">Hs. entrega</Label>
              <Input
                id="customer-delivery-hours"
                value={deliveryHours}
                onChange={(e) => setDeliveryHours(e.target.value)}
                placeholder="Ej. 8:00 hs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="customer-price-list">Lista de precios</Label>
            <select
              id="customer-price-list"
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
                  {inactiveSelected.name} (deshabilitada)
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
      </FormSection>

      <FormSection
        title="Observaciones"
        description="Notas internas; el cliente no las ve."
      >
        <Label htmlFor="customer-notes" className="sr-only">
          Observaciones
        </Label>
        <textarea
          id="customer-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={cn(
            "flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
            FOCUS_BRAND_BORDER,
          )}
        />
      </FormSection>

      <FormSection
        title="Acceso y módulos"
        description={
          <>
            Elegí qué secciones de stock ve el cliente en{" "}
            <span className="font-medium">/stock</span>.
          </>
        }
        className="space-y-6"
      >
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Módulos de stock
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            {CUSTOMER_MODULES.map((module) => (
              <FormToggleCard
                key={module}
                id={`customer-module-${module}`}
                label={CUSTOMER_MODULE_LABELS[module]}
                description={CUSTOMER_MODULE_DESCRIPTIONS[module]}
                checked={modules[module]}
                onChange={(checked) =>
                  setModules((prev) => ({
                    ...prev,
                    [module]: checked,
                  }))
                }
              />
            ))}
          </div>
        </div>

        {customer ? (
          <div className="space-y-2 border-t border-neutral-200 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Seguridad
            </p>
            <FormToggleCard
              id="customer-reset-pin"
              label="Regenerar PIN"
              description="Genera un PIN nuevo a partir del código del cliente. El cliente deberá cambiarlo al ingresar."
              checked={resetPin}
              onChange={setResetPin}
            />
          </div>
        ) : null}

        <div className="space-y-2 border-t border-neutral-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Cuenta
          </p>
          <FormToggleCard
            id="customer-enabled"
            label={
              active
                ? `Cuenta ${CUSTOMER_ACCOUNT_STATUS_LABELS.enabled.toLowerCase()}`
                : `Cuenta ${CUSTOMER_ACCOUNT_STATUS_LABELS.disabled.toLowerCase()}`
            }
            description="Si está deshabilitada, no puede iniciar sesión ni cotizar."
            checked={active}
            onChange={setActive}
          />
        </div>
      </FormSection>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

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
