"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useCustomerNavStore } from "@/stores/customer-nav-store";

const CUSTOMER_SHELL_PREFIXES = [
  "/cotizar",
  "/remitos",
  "/stock",
  "/cuenta",
] as const;

function isCustomerShellPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return CUSTOMER_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Hamburger for customer drawer — lives in AppHeader (mobile only). */
export function CustomerMenuButton() {
  const pathname = usePathname();
  const open = useCustomerNavStore((s) => s.open);
  const setOpen = useCustomerNavStore((s) => s.setOpen);

  const onCustomerShell = isCustomerShellPath(pathname);

  if (!onCustomerShell) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Abrir menú"
      aria-expanded={open}
      aria-controls="customer-mobile-nav"
      className="admin-mobile-only rounded-md p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
