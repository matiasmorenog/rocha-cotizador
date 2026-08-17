"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  formatStaffPermissionLabels,
  staffSwitchesFromProfile,
} from "@/lib/staff-permissions";
import type { StaffRole } from "@/types/auth";

type StaffUser = {
  id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  canQuotes: boolean;
  canStock: boolean;
  active: boolean;
};

export function StaffUsersPanel({
  users: initial,
  currentUserId,
}: {
  users: StaffUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = useMemo(
    () => users.find((u) => u.id === editingId) ?? null,
    [users, editingId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-600">
          Usuarios internos con email y permisos (Administración, Cotización, Stock).
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
        >
          Nuevo usuario
        </Button>
      </div>

      {creating || editing ? (
        <StaffUserForm
          key={editing?.id ?? "new"}
          user={editing ?? undefined}
          currentUserId={currentUserId}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
          onSaved={(saved) => {
            setUsers((prev) => {
              const idx = prev.findIndex((u) => u.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [saved, ...prev];
            });
            setCreating(false);
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Permisos</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.name ?? "—"}</td>
                <td className="px-3 py-2">
                  {formatStaffPermissionLabels(u)}
                </td>
                <td className="px-3 py-2">
                  {u.active ? "Activo" : "Inactivo"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-[var(--brand-primary)] hover:underline"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(u.id);
                    }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionSwitch({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </div>
  );
}

function StaffUserForm({
  user,
  currentUserId,
  onCancel,
  onSaved,
}: {
  user?: StaffUser;
  currentUserId: string;
  onCancel: () => void;
  onSaved: (user: StaffUser) => void;
}) {
  const isEdit = Boolean(user);
  const initialSwitches = user
    ? staffSwitchesFromProfile(user)
    : { isAdmin: false, canQuotes: true, canStock: false };

  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [isAdmin, setIsAdmin] = useState(initialSwitches.isAdmin);
  const [canQuotes, setCanQuotes] = useState(initialSwitches.canQuotes);
  const [canStock, setCanStock] = useState(initialSwitches.canStock);
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onAdminChange(checked: boolean) {
    setIsAdmin(checked);
    if (checked) {
      setCanQuotes(true);
      setCanStock(true);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin && !canQuotes && !canStock) {
      setError("Elegí al menos un permiso (Cotización o Stock)");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user?.id,
        email,
        name: name || null,
        isAdmin,
        canQuotes: isAdmin ? true : canQuotes,
        canStock: isAdmin ? true : canStock,
        active,
        ...(password ? { password } : {}),
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      return;
    }
    onSaved(data.user as StaffUser);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-neutral-800">
        {isEdit ? "Editar usuario" : "Nuevo usuario"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>
            {isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-800">Permisos</p>
        <PermissionSwitch
          label="Administración"
          description="Acceso completo al panel (usuarios, configuración, etc.)"
          checked={isAdmin}
          onChange={onAdminChange}
        />
        <PermissionSwitch
          label="Cotización"
          description="Productos, listas de precios y cotizaciones"
          checked={canQuotes}
          onChange={setCanQuotes}
          disabled={isAdmin}
        />
        <PermissionSwitch
          label="Stock"
          description="Mermas y consumibles"
          checked={canStock}
          onChange={setCanStock}
          disabled={isAdmin}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-neutral-800">Activo</p>
          <p className="text-xs text-neutral-500">
            {user?.id === currentUserId
              ? "No podés desactivar tu propia cuenta"
              : "Usuarios inactivos no pueden ingresar"}
          </p>
        </div>
        <Switch
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={user?.id === currentUserId}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
