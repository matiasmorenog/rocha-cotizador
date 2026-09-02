import { getOrderCutoffHourAr } from "@/lib/business-settings";
import { OrderCutoffSettingsForm } from "@/components/admin/order-cutoff-settings-form";

export async function OrderCutoffSettingsSection() {
  const orderCutoffHourAr = await getOrderCutoffHourAr();

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">Horario de cierre</p>
      <p className="mt-1 text-neutral-600">
        Hora límite (Argentina) para el batch del día siguiente en cotizaciones
        y fecha mínima de entrega.
      </p>
      <div className="mt-3">
        <OrderCutoffSettingsForm initialHour={orderCutoffHourAr} />
      </div>
    </div>
  );
}
