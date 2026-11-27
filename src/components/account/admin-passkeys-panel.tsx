"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export type AdminPasskeyRow = {
  id: string;
  friendlyName: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  initialPasskeys: AdminPasskeyRow[];
  /** When true, hide register CTA (mustChangePassword / seed PIN). */
  registrationBlocked?: boolean;
  registrationBlockedReason?: string;
};

export function AdminPasskeysPanel({
  initialPasskeys,
  registrationBlocked = false,
  registrationBlockedReason,
}: Props) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState("");

  async function reloadList() {
    const res = await fetch("/api/admin/passkeys");
    if (!res.ok) return;
    const data = (await res.json()) as { passkeys?: AdminPasskeyRow[] };
    setPasskeys(data.passkeys ?? []);
    router.refresh();
  }

  async function onRegister() {
    setError(null);
    setMessage(null);
    if (registrationBlocked) {
      setError(
        registrationBlockedReason ??
          "Cambiá tu contraseña antes de agregar un passkey.",
      );
      return;
    }
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setError("Este dispositivo o navegador no soporta passkeys.");
      return;
    }

    setBusy(true);
    try {
      const optRes = await fetch("/api/admin/passkeys/register/options", {
        method: "POST",
      });
      if (!optRes.ok) {
        const data = await optRes.json().catch(() => ({}));
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo iniciar el registro",
        );
        return;
      }
      const optionsJSON = await optRes.json();
      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/admin/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: attestation,
          friendlyName: friendlyName.trim() || null,
        }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo guardar el passkey",
        );
        return;
      }
      setFriendlyName("");
      setMessage(
        "Passkey agregado. Ya podés ingresar con huella / Face ID / PIN del dispositivo.",
      );
      await reloadList();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Registro cancelado.");
      } else {
        console.error("[passkeys] register", err);
        setError("No se pudo registrar el passkey en este dispositivo.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    setError(null);
    setMessage(null);
    if (
      !window.confirm(
        "¿Quitar este passkey? Vas a necesitar la contraseña para ingresar desde este dispositivo.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/passkeys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "No se pudo revocar",
        );
        return;
      }
      setMessage("Passkey eliminado.");
      await reloadList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">Acceso con passkey</p>
      <p className="mt-1 text-neutral-600">
        Usá la huella, Face ID o el PIN de este dispositivo. No hace falta una
        llave USB. La contraseña sigue disponible como respaldo.
      </p>

      <ul className="mt-3 space-y-2">
        {passkeys.length === 0 ? (
          <li className="text-neutral-500">Todavía no hay passkeys.</li>
        ) : (
          passkeys.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  {p.friendlyName?.trim() || "Este dispositivo"}
                </p>
                <p className="text-xs text-neutral-500">
                  Creado {formatDate(p.createdAt)}
                  {p.lastUsedAt
                    ? ` · Último uso ${formatDate(p.lastUsedAt)}`
                    : null}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => void onRevoke(p.id)}
              >
                Quitar
              </Button>
            </li>
          ))
        )}
      </ul>

      {registrationBlocked ? (
        <p className="mt-3 text-sm text-amber-800">
          {registrationBlockedReason ??
            "Cambiá tu contraseña (PIN inicial) antes de agregar un passkey."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="passkey-name">Nombre (opcional)</Label>
            <Input
              id="passkey-name"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Ej. iPhone de trabajo"
              maxLength={80}
              disabled={busy}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void onRegister()}
            className="w-full"
          >
            {busy ? (
              <>
                <Spinner className="mr-2" />
                Esperando dispositivo…
              </>
            ) : (
              "Agregar huella / Face ID / PIN"
            )}
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}
