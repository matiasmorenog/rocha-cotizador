import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import {
  executeCustomersImport,
  loadCustomersImportFromBuffer,
  validateCustomersImport,
} from "@/lib/customers-excel-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    return await runCustomersImport(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno al importar";
    console.error("[customers/import]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runCustomersImport(req: NextRequest) {
  if (!(await requireStaffApi("customers"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Falta archivo (campo file)" },
      { status: 400 },
    );
  }

  const loaded = await loadCustomersImportFromBuffer(await file.arrayBuffer());
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "validate") {
    return NextResponse.json(validateCustomersImport(loaded.ctx));
  }

  const summary = await executeCustomersImport(loaded.ctx);
  return NextResponse.json(summary);
}
