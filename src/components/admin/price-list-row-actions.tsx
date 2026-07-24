"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PriceListRowActions({
  id,
  name,
  customerCount,
}: {
  id: string;
  name: string;
  customerCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const customersNote =
      customerCount > 0
        ? ` ${customerCount} cliente(s) pasarán a Mayorista (base).`
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
          className="text-sm text-[var(--brand-primary)] underline hover:opacity-80"
        >
          Editar
        </Link>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={loading}
          onClick={() => void onDelete()}
        >
          {loading ? "…" : "Eliminar"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
