import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import {
  getOrderCutoffHourAr,
  getWhatsAppNotifyDigits,
  ORDER_CUTOFF_HOUR_MAX,
  ORDER_CUTOFF_HOUR_MIN,
  setOrderCutoffHourAr,
  setWhatsAppNotifyPhone,
} from "@/lib/business-settings";

export async function GET() {
  if (!(await requireStaffApi("settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [whatsappNotifyPhone, orderCutoffHourAr] = await Promise.all([
    getWhatsAppNotifyDigits(),
    getOrderCutoffHourAr(),
  ]);
  return NextResponse.json({ whatsappNotifyPhone, orderCutoffHourAr });
}

const putSchema = z
  .object({
    whatsappNotifyPhone: z.string().min(6).optional(),
    orderCutoffHourAr: z.coerce
      .number()
      .int()
      .min(ORDER_CUTOFF_HOUR_MIN)
      .max(ORDER_CUTOFF_HOUR_MAX)
      .optional(),
  })
  .refine(
    (data) =>
      data.whatsappNotifyPhone !== undefined ||
      data.orderCutoffHourAr !== undefined,
    { message: "No settings to update" },
  );

export async function PUT(req: NextRequest) {
  if (!(await requireStaffApi("settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    let whatsappNotifyPhone: string | undefined;
    let orderCutoffHourAr: number | undefined;

    if (parsed.data.whatsappNotifyPhone !== undefined) {
      whatsappNotifyPhone = await setWhatsAppNotifyPhone(
        parsed.data.whatsappNotifyPhone,
      );
    }
    if (parsed.data.orderCutoffHourAr !== undefined) {
      orderCutoffHourAr = await setOrderCutoffHourAr(
        parsed.data.orderCutoffHourAr,
      );
    }

    const body = {
      whatsappNotifyPhone:
        whatsappNotifyPhone ?? (await getWhatsAppNotifyDigits()),
      orderCutoffHourAr:
        orderCutoffHourAr ?? (await getOrderCutoffHourAr()),
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_PHONE") {
      return NextResponse.json(
        { error: "Número de WhatsApp inválido" },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message === "INVALID_CUTOFF_HOUR") {
      return NextResponse.json(
        { error: "Hora de corte inválida" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
