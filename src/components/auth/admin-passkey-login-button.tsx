"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLoginShake } from "@/components/auth/login-card";
import { saveLastAdminEmail } from "@/lib/last-login";

type Props = {
  callbackUrl: string;
  /** Remembered / typed email — narrows allowCredentials when present. */
  email?: string;
  onError?: (message: string) => void;
};

export function AdminPasskeyLoginButton({
  callbackUrl,
  email,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const { shake } = useLoginShake();

  async function onPasskeyLogin() {
    onError?.("");
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      const msg = "Este dispositivo o navegador no soporta passkeys.";
      onError?.(msg);
      shake();
      return;
    }

    setLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email?.trim() ? email.trim() : null,
        }),
      });
      if (!optRes.ok) {
        const data = await optRes.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : "No se pudo iniciar el acceso con passkey";
        onError?.(msg);
        shake();
        return;
      }
      const optionsJSON = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Passkey no reconocido";
        onError?.(msg);
        shake();
        return;
      }
      const { ticket } = (await verifyRes.json()) as { ticket?: string };
      if (!ticket) {
        onError?.("No se pudo completar el acceso");
        shake();
        return;
      }

      const result = await signIn("passkey", {
        ticket,
        redirect: false,
      });
      if (result?.error) {
        onError?.(
          result.error === "Configuration"
            ? "Error de configuración del servidor de acceso. Si persiste, avisá a soporte."
            : "No se pudo iniciar sesión con passkey",
        );
        shake();
        return;
      }

      if (email?.trim()) {
        saveLastAdminEmail(email.trim());
      }
      window.location.assign(callbackUrl);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError") {
        onError?.("Acceso con passkey cancelado.");
      } else {
        console.error("[passkeys] login", err);
        onError?.("No se pudo usar el passkey en este dispositivo.");
      }
      shake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={() => void onPasskeyLogin()}
    >
      {loading ? (
        <>
          <Spinner className="mr-2" />
          Esperando dispositivo…
        </>
      ) : (
        "Usar huella / Face ID / PIN"
      )}
    </Button>
  );
}
