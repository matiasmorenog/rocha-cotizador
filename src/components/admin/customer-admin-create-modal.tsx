"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { FormSection } from "@/components/admin/form-section";
import { FormToggleCard } from "@/components/admin/form-toggle-card";
import {
  AdminDraftModal,
  AdminDraftModalBody,
  AdminDraftModalFooter,
  AdminDraftModalHeader,
} from "@/components/ui/admin-draft-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDraftSession,
  type DraftSessionInfo,
} from "@/hooks/use-draft-session";
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

const TITLE_ID = "customer-create-title";

/** Create-only customer draft modal. Edits stay inline via CustomerAdminForm. */
export function CustomerAdminCreateModal({
  priceLists,
  open,
  onOpenChange,
  onDraftChange,
}: {
  priceLists: PriceListOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange?: (draft: DraftSessionInfo) => void;
}) {
  const router = useRouter();
  const baseListId =
    priceLists.find((l) => l.isBase)?.id ?? priceLists[0]?.id ?? "";
  const [formKey, setFormKey] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameNote, setNameNote] = useState("");
  const [priceListId, setPriceListId] = useState(baseListId);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryHours, setDeliveryHours] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [modules, setModules] = useState<CustomerModuleFlags>(
    DEFAULT_CUSTOMER_MODULE_FLAGS,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dirtyCount = useMemo(() => {
    let n = 0;
    if (code.trim()) n += 1;
    if (name.trim()) n += 1;
    if (nameNote.trim()) n += 1;
    if (address.trim()) n += 1;
    if (phone.trim()) n += 1;
    if (email.trim()) n += 1;
    return n;
  }, [code, name, nameNote, address, phone, email]);

  const {
    open: modalOpen,
    setOpen,
    minimize,
    endSession,
    showShell,
    showChip,
    exiting,
    animKey,
  } = useDraftSession({
    open,
    onOpenChange,
    itemCount: dirtyCount,
    onDraftChange,
  });

  function resetFields() {
    setCode("");
    setName("");
    setNameNote("");
    setPriceListId(baseListId);
    setAddress("");
    setPhone("");
    setEmail("");
    setPaymentTerms("");
    setDeliveryHours("");
    setNotes("");
    setActive(true);
    setModules(DEFAULT_CUSTOMER_MODULE_FLAGS);
    setError(null);
    setFormKey((k) => k + 1);
  }

  function discardDraft() {
    resetFields();
    endSession();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          resetPin: true,
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
        dispatchAdminInAppToast({
          title: "Cliente creado",
          body: `${savedLabel}. PIN inicial: ${data.pin}. El cliente debe cambiarlo por una contraseña.`,
          tone: "success",
        });
      } else {
        dispatchAdminInAppToast({
          title: "Cliente creado",
          body: savedLabel,
          tone: "success",
        });
      }
      resetFields();
      endSession();
      router.refresh();
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
  const chipSubtitle = name.trim()
    ? name.trim()
    : code.trim()
      ? code.trim()
      : dirtyCount > 0
        ? `${dirtyCount} campo${dirtyCount === 1 ? "" : "s"}`
        : "Sin datos aún";

  return (
    <AdminDraftModal
      open={modalOpen}
      showShell={showShell}
      showChip={showChip}
      exiting={exiting}
      animKey={animKey}
      labelledBy={TITLE_ID}
      onMinimize={minimize}
      onResume={() => setOpen(true)}
      maxWidthClassName="max-w-3xl"
      chip={{
        title: "Cliente en curso",
        subtitle: chipSubtitle,
        icon: UserPlus,
      }}
    >
      <form
        key={formKey}
        onSubmit={onSubmit}
        className="flex max-h-[min(90vh,52rem)] flex-col"
      >
        <AdminDraftModalHeader
          titleId={TITLE_ID}
          title="Nuevo cliente"
          description="Alta de cuenta. El PIN inicial se genera al guardar."
        />
        <AdminDraftModalBody>
          <FormSection
            title="Identificación"
            description="Código de ingreso y nombre que ve el cliente al cotizar."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="shrink-0 space-y-1">
                <Label htmlFor="customer-create-code">Código</Label>
                <Input
                  id="customer-create-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  inputMode="numeric"
                  maxLength={3}
                  className="w-20 max-w-[4rem]"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="customer-create-name">Nombre</Label>
                <Input
                  id="customer-create-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="customer-create-name-note">Aclaración</Label>
                <Input
                  id="customer-create-name-note"
                  value={nameNote}
                  onChange={(e) => setNameNote(e.target.value)}
                  placeholder="Opcional — ej. contacto o sucursal"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Contacto">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="customer-create-email">Email</Label>
                <Input
                  id="customer-create-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="customer-create-phone">Teléfono</Label>
                <Input
                  id="customer-create-phone"
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
                <Label htmlFor="customer-create-address">Dirección</Label>
                <Input
                  id="customer-create-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="customer-create-payment">Forma de pago</Label>
                  <Input
                    id="customer-create-payment"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Ej. CC / Mensual / Efectivo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="customer-create-delivery">Hs. entrega</Label>
                  <Input
                    id="customer-create-delivery"
                    value={deliveryHours}
                    onChange={(e) => setDeliveryHours(e.target.value)}
                    placeholder="Ej. 8:00 hs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="customer-create-price-list">
                  Lista de precios
                </Label>
                <select
                  id="customer-create-price-list"
                  value={priceListId}
                  onChange={(e) => setPriceListId(e.target.value)}
                  className={cn(
                    "flex h-10 w-full rounded-md border border-neutral-300 bg-white py-2 pl-3 pr-10 text-sm",
                    FOCUS_BRAND_BORDER,
                  )}
                  required
                >
                  {activeLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Observaciones"
            description="Notas internas; el cliente no las ve."
          >
            <textarea
              id="customer-create-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(
                "flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm",
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
                    id={`customer-create-module-${module}`}
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
            <div className="space-y-2 border-t border-neutral-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Cuenta
              </p>
              <FormToggleCard
                id="customer-create-enabled"
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
        </AdminDraftModalBody>
        <AdminDraftModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={minimize}
          >
            Minimizar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={discardDraft}
          >
            Descartar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando…" : "Crear cliente"}
          </Button>
        </AdminDraftModalFooter>
      </form>
    </AdminDraftModal>
  );
}
