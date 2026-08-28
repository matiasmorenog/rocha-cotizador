"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  currentEmail: string;
  apiPath?: string;
  onSuccess?: (email: string) => void | Promise<void>;
  className?: string;
};

export function ChangeEmailForm({
  currentEmail,
  apiPath = "/api/admin/account/email",
  onSuccess,
  className,
}: Props) {
  const router = useRouter();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const res = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo cambiar el email");
      return;
    }

    const savedEmail = String(data.email ?? newEmail).trim().toLowerCase();
    setMessage("Email actualizado");
    setNewEmail("");
    setCurrentPassword("");
    if (onSuccess) {
      try {
        await onSuccess(savedEmail);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar la sesión",
        );
        return;
      }
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="current-email">Email actual</Label>
        <Input
          id="current-email"
          type="email"
          value={currentEmail}
          readOnly
          className="bg-neutral-50 text-neutral-700"
          autoComplete="username"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-email">Email nuevo</Label>
        <Input
          id="new-email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-current-password">Contraseña actual</Label>
        <PasswordInput
          id="email-current-password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <p className="text-xs text-neutral-500">
          Confirmá tu identidad antes de cambiar el email de acceso.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || !newEmail.trim() || !currentPassword}
        >
          {loading ? (
            <>
              <Spinner className="mr-2 text-white" />
              Guardando…
            </>
          ) : (
            "Cambiar email"
          )}
        </Button>
      </div>
    </form>
  );
}
