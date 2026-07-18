"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function CustomerLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("customer", {
      code,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Código o contraseña incorrectos");
      return;
    }
    router.push("/cotizar");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de cliente</Label>
        <Input
          id="code"
          inputMode="numeric"
          maxLength={3}
          placeholder="001"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="PIN inicial o tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="text-xs text-neutral-500">
          Primer acceso: usá el PIN de 4 dígitos. Después cambiá a una contraseña en Configuración.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading || code.length < 1 || password.length < 1}>
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
