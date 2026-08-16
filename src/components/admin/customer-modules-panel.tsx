"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CUSTOMER_MODULE_LABELS } from "@/lib/customer-modules";
import type { CustomerModule } from "@prisma/client";

type Row = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  modules: { MERMAS: boolean; CONSUMABLES: boolean };
};

const MODULES: CustomerModule[] = ["MERMAS", "CONSUMABLES"];

export function CustomerModulesPanel({ customers: initial }: { customers: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  async function toggle(
    customerId: string,
    module: CustomerModule,
    enabled: boolean,
  ) {
    const key = `${customerId}:${module}`;
    setBusyKey(key);
    setError(null);
    const res = await fetch("/api/admin/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, module, enabled }),
    });
    setBusyKey(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo actualizar");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === customerId
          ? { ...r, modules: { ...r.modules, [module]: enabled } }
          : r,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por código o nombre…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              {MODULES.map((m) => (
                <th key={m} className="px-3 py-2 font-medium">
                  {CUSTOMER_MODULE_LABELS[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">
                  <span className={!r.active ? "text-neutral-400" : undefined}>
                    {r.name}
                  </span>
                </td>
                {MODULES.map((m) => {
                  const key = `${r.id}:${m}`;
                  return (
                    <td key={m} className="px-3 py-2">
                      <Switch
                        checked={r.modules[m]}
                        disabled={busyKey === key}
                        onChange={(e) =>
                          void toggle(r.id, m, e.target.checked)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
