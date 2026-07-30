"use client";

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  whatsappUrl: string;
  /** Auto-open wa.me once (e.g. after quote create with ?whatsapp=1). */
  autoOpen?: boolean;
};

export function WhatsAppNotifyButton({ whatsappUrl, autoOpen = false }: Props) {
  const tried = useRef(false);

  useEffect(() => {
    if (!autoOpen || tried.current) return;
    tried.current = true;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }, [autoOpen, whatsappUrl]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 print:hidden">
      <p className="min-w-0 flex-1 text-sm text-emerald-950">
        Avisá el pedido por WhatsApp. Se abre en este dispositivo hacia el número
        del negocio.
      </p>
      <Button
        type="button"
        className="shrink-0"
        onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
      >
        <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
        Enviar por WhatsApp
      </Button>
    </div>
  );
}
