import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tag-names";
import type { StaffRole } from "@/types/auth";

export type AdminStaffUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  canQuotes: boolean;
  canStock: boolean;
  active: boolean;
};

async function fetchAdminUsuariosUncached(): Promise<AdminStaffUserRow[]> {
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "QUOTES", "STOCK"] } },
    orderBy: [{ active: "desc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      canQuotes: true,
      canStock: true,
      active: true,
    },
  });

  return users.map((u) => ({
    ...u,
    role: u.role as StaffRole,
  }));
}

const getCachedAdminUsuarios = unstable_cache(
  fetchAdminUsuariosUncached,
  ["admin-usuarios-page"],
  { tags: [CACHE_TAGS.staffUsers], revalidate: 86400 },
);

export function getAdminUsuariosPageData(): Promise<AdminStaffUserRow[]> {
  return getCachedAdminUsuarios();
}
