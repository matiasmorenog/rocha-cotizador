"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Remito header back control — same outline Button as Imprimir / Editar. */
export function RemitoBackButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      className="print:hidden"
      onClick={() => (href ? router.push(href) : router.back())}
    >
      Volver
    </Button>
  );
}
