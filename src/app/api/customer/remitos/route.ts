import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseArgentinaDateTime } from "@/lib/argentina-time";
import { getCustomerRemitos } from "@/lib/customer-remitos-data";

/**
 * GET /api/customer/remitos?from=&to=&q=
 * Customer remitos list for filters / search (no full page reload).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const fromParam = sp.get("from")?.trim() || null;
  const toParam = sp.get("to")?.trim() || null;
  const search = sp.get("q")?.trim() || null;

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromParam || toParam) {
    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "Indicá fecha Desde y Hasta para filtrar por rango" },
        { status: 400 },
      );
    }
    from = parseArgentinaDateTime(fromParam);
    to = parseArgentinaDateTime(toParam);
    if (!from || !to) {
      return NextResponse.json(
        { error: "Fechas inválidas" },
        { status: 400 },
      );
    }
    if (from.getTime() >= to.getTime()) {
      return NextResponse.json(
        { error: "El rango es inválido: 'Desde' debe ser anterior a 'Hasta'" },
        { status: 400 },
      );
    }
  }

  const remitos = await getCustomerRemitos(session.user.customerId, {
    from,
    to,
    search,
  });

  return NextResponse.json(
    { remitos },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
