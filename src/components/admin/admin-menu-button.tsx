"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAdminNavStore } from "@/stores/admin-nav-store";

/** Hamburger for admin drawer — lives in AppHeader (mobile only). */
export function AdminMenuButton() {
  const pathname = usePathname();
  const open = useAdminNavStore((s) => s.open);
  const setOpen = useAdminNavStore((s) => s.setOpen);

  const onAdminShell =
    pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (!onAdminShell) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Abrir menú"
      aria-expanded={open}
      aria-controls="admin-mobile-nav"
      className="rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
