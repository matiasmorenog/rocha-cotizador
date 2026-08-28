"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { cn } from "@/lib/utils";

type Props = {
  apiPath?: string;
  /** Customer PIN hint under current password. */
  showPinHint?: boolean;
  onSuccess?: () => void | Promise<void>;
  className?: string;
};

export function ChangePasswordForm({
  apiPath = "/api/account/password",
  showPinHint = true,
  onSuccess,
  className,
}: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setLoading(true);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar la contraseña");
      return;
    }
    setMessage("Contraseña actualizada");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (onSuccess) {
      await onSuccess();
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="current">Contraseña actual</Label>
        <PasswordInput
          id="current"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        {showPinHint ? (
          <p className="text-xs text-neutral-500">
            Si todavía no la cambiaste, usá el PIN de 4 dígitos.
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new">Contraseña nueva</Label>
        <PasswordInput
          id="new"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <p className="text-xs text-neutral-500">Mínimo {MIN_PASSWORD_LENGTH} caracteres.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading || newPassword.length < MIN_PASSWORD_LENGTH}
        >
          {loading ? (
            <>
              <Spinner className="mr-2 text-white" />
              Guardando…
            </>
          ) : (
            "Cambiar contraseña"
          )}
        </Button>
      </div>
    </form>
  );
}
