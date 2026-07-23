import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp-settings-form";

export default async function AdminConfigPage() {
  const whatsappNotifyPhone = await getWhatsAppNotifyDigits();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Configuración</h1>
        <p className="text-sm text-neutral-600">
          Ajustes generales del cotizador.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          WhatsApp
        </h2>
        <WhatsAppSettingsForm initialPhone={whatsappNotifyPhone} />
      </section>
    </div>
  );
}
