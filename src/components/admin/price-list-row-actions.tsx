"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PriceListRowActions({
  id,
  name,
  customerCount,
  isBase = false,
}: {
  id: string;
  name: string;
  customerCount: number;
  isBase?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (isBase) return;
    const customersNote =
      customerCount > 0
        ? ` ${customerCount} cliente(s) pasarán a Precio base.`
        : "";
    if (
      !window.confirm(
        `¿Eliminar la lista “${name}”?${customersNote} Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/price-lists/${id}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo eliminar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/admin/listas-precios/${id}`}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[var(--brand-primary)] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
          aria-label="Editar"
          title="Editar"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Link>
        {!isBase ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={loading}
            onClick={() => void onDelete()}
            className="h-8 w-8 px-0"
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
        )}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
