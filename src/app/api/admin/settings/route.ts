import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/api-auth";
import {
  getWhatsAppNotifyDigits,
  setWhatsAppNotifyPhone,
} from "@/lib/business-settings";

export async function GET() {
  if (!(await requireStaffApi("settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const whatsappNotifyPhone = await getWhatsAppNotifyDigits();
  return NextResponse.json({ whatsappNotifyPhone });
}

const putSchema = z.object({
  whatsappNotifyPhone: z.string().min(6),
});

export async function PUT(req: NextRequest) {
  if (!(await requireStaffApi("settings"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const whatsappNotifyPhone = await setWhatsAppNotifyPhone(
      parsed.data.whatsappNotifyPhone,
    );
    return NextResponse.json({ whatsappNotifyPhone });
  } catch {
    return NextResponse.json(
      { error: "Número de WhatsApp inválido" },
      { status: 400 },
    );
  }
}
