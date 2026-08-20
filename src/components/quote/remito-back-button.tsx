"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useRouteLoading } from "@/lib/route-loading-context";

/** Remito header back control — same outline Button as print / Editar. */
export function RemitoBackButton({ href }: { href?: string }) {
  const router = useRouter();
  const { startLoading } = useRouteLoading();

  return (
    <Button
      type="button"
      variant="outline"
      className="print:hidden"
      onClick={() => {
        if (href) {
          startLoading(href);
          router.push(href);
          return;
        }
        startLoading();
        router.back();
      }}
    >
      Volver
    </Button>
  );
}
