import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp-settings-form";

export async function WhatsAppSettingsSection() {
  const whatsappNotifyPhone = await getWhatsAppNotifyDigits();

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">WhatsApp</p>
      <p className="mt-1 text-neutral-600">
        Número para abrir WhatsApp (wa.me) al confirmar una cotización de
        cliente.
      </p>
      <div className="mt-3">
        <WhatsAppSettingsForm initialPhone={whatsappNotifyPhone} />
      </div>
    </div>
  );
}
