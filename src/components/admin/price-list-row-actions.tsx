"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  AdminTableActions,
  AdminTableIconAction,
} from "@/components/admin/admin-table";

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
      <AdminTableActions className="justify-end">
        <AdminTableIconAction
          label="Editar"
          icon={Pencil}
          href={`/admin/listas-precios/${id}`}
        />
        {!isBase ? (
          <AdminTableIconAction
            label="Eliminar"
            icon={Trash2}
            variant="destructive"
            loading={loading}
            onClick={() => void onDelete()}
          />
        ) : (
          <span className="inline-block size-8 shrink-0" aria-hidden />
        )}
      </AdminTableActions>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
