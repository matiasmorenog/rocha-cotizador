import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import {
  executeProductsImport,
  loadProductsImportFromBuffer,
  validateProductsImport,
} from "@/lib/products-excel-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    return await runProductsImport(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno al importar";
    console.error("[products/import]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runProductsImport(req: NextRequest) {
  if (!(await requireStaffApi("products"))) {
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

  const loaded = await loadProductsImportFromBuffer(await file.arrayBuffer());
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const mode = req.nextUrl.searchParams.get("mode");
  if (mode === "validate") {
    return NextResponse.json(validateProductsImport(loaded.ctx));
  }

  const summary = await executeProductsImport(loaded.ctx);
  return NextResponse.json(summary);
}
