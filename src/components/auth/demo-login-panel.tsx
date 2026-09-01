"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useLoginShake } from "@/components/auth/login-card";
import { safeCallbackUrl } from "@/lib/callback-url";
import {
  demoPersonasForUi,
  type DemoPersonaSpec,
} from "@/lib/demo-personas";
import { cn } from "@/lib/utils";

export type DemoLoginKind = "customer" | "staff" | "all";

type DemoLoginFormProps = {
  kind: DemoLoginKind;
  /** Default callback when none in URL (customer `/`, staff `/admin`). */
  defaultCallback?: string;
};

function defaultCallbackForPersona(persona: DemoPersonaSpec): string {
  return persona.kind === "staff" ? "/admin" : "/";
}

function groupLabel(kind: DemoPersonaSpec["kind"]): string {
  return kind === "customer" ? "Clientes" : "Administración";
}

export function DemoLoginForm({ kind, defaultCallback }: DemoLoginFormProps) {
  const searchParams = useSearchParams();
  const urlCallback = safeCallbackUrl(
    searchParams.get("callbackUrl"),
    defaultCallback ?? (kind === "staff" ? "/admin" : "/"),
  );
  const personas = useMemo(() => demoPersonasForUi(kind), [kind]);
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { shake } = useLoginShake();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!personaId) return;
    setError(null);
    setLoading(true);

    const persona = personas.find((p) => p.id === personaId);
    const callbackUrl =
      urlCallback !== "/" && urlCallback !== "/admin"
        ? urlCallback
        : persona
          ? defaultCallbackForPersona(persona)
          : urlCallback;

    const result = await signIn("demo", {
      personaId,
      redirect: false,
    });

    if (result?.error) {
      setError("No se pudo iniciar la sesión demo. ¿Corriste el seed?");
      shake();
      setLoading(false);
      return;
    }

    window.location.assign(callbackUrl);
  }

  const customerPersonas = personas.filter((p) => p.kind === "customer");
  const staffPersonas = personas.filter((p) => p.kind === "staff");

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="demo-persona">Persona demo</Label>
        <select
          id="demo-persona"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          className={cn(
            "flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40",
          )}
          required
        >
          {kind === "all" ? (
            <>
              <optgroup label={groupLabel("customer")}>
                {customerPersonas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={groupLabel("staff")}>
                {staffPersonas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))
          )}
        </select>
        {personaId ? (
          <p className="text-xs text-neutral-500">
            {personas.find((p) => p.id === personaId)?.description}
          </p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading || !personaId}>
        {loading ? (
          <>
            <Spinner className="mr-2 text-white" />
            Ingresando…
          </>
        ) : (
          "Entrar como demo"
        )}
      </Button>
    </form>
  );
}

/** Collapsible demo access — replaces credential form while open. */
export function LoginWithDemoOption({
  kind,
  children,
}: {
  kind: Exclude<DemoLoginKind, "all">;
  children: React.ReactNode;
}) {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="space-y-4">
      {!demoOpen ? children : null}
      <details
        className="rounded-lg border border-dashed border-[var(--brand-primary)]/35 bg-white/60"
        open={demoOpen}
        onToggle={(e) => setDemoOpen(e.currentTarget.open)}
      >
        <summary
          className={cn(
            "cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-[var(--brand-primary)]",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span>Inicio demo</span>
            <span className="text-xs font-normal text-neutral-500">
              {demoOpen ? "Ocultar" : "Acceso rápido"}
            </span>
          </span>
        </summary>
        {demoOpen ? (
          <div className="space-y-3 border-t border-[var(--brand-primary)]/15 px-3 pb-4 pt-3">
            <p className="text-xs text-neutral-600">
              Elegí una persona de prueba. Sin contraseña — solo en development /
              preview.
            </p>
            <DemoLoginForm kind={kind} />
          </div>
        ) : null}
      </details>
    </div>
  );
}

/** Demo block for /entrar — no credential form to swap. */
export function EntrarDemoSection() {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="w-full rounded-lg border border-dashed border-[var(--brand-primary)]/35 bg-white/60"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        className={cn(
          "cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-[var(--brand-primary)]",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span>Inicio demo</span>
          <span className="text-xs font-normal text-neutral-500">
            Portfolio / testeo
          </span>
        </span>
      </summary>
      {open ? (
        <div className="space-y-3 border-t border-[var(--brand-primary)]/15 px-3 pb-4 pt-3">
          <p className="text-center text-xs text-neutral-600">
            Clientes y administración en un click — personas fijas del seed.
          </p>
          <DemoLoginForm kind="all" defaultCallback="/" />
        </div>
      ) : null}
    </details>
  );
}
