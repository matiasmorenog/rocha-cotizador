import { requireStaffPermission } from "@/lib/session";
import { db } from "@/lib/db";
import { StaffUsersPanel } from "@/components/admin/staff-users-panel";
import type { StaffRole } from "@/types/auth";

export default async function AdminUsuariosPage() {
  const session = await requireStaffPermission("users");

  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "QUOTES", "STOCK"] } },
    orderBy: [{ active: "desc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Usuarios</h1>
        <p className="text-sm text-neutral-600">
          Alta y roles del equipo interno (Administración, Cotización, Stock).
        </p>
      </div>
      <StaffUsersPanel
        users={users.map((u) => ({
          ...u,
          role: u.role as StaffRole,
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
