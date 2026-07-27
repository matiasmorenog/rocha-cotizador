"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { safeCallbackUrl } from "@/lib/callback-url";
import {
  readLastAdminEmail,
  saveLastAdminEmail,
  subscribeToLastLoginStorage,
} from "@/lib/last-login";

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/admin");
  const rememberedEmail = useSyncExternalStore(
    subscribeToLastLoginStorage,
    readLastAdminEmail,
    () => "",
  );
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const email = emailDraft ?? rememberedEmail;
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Prefer FormData so browser password-manager autofill is not lost when
    // React controlled state never received onChange (common after remember-login).
    const fd = new FormData(e.currentTarget);
    const submittedEmail = String(fd.get("email") ?? email).trim();
    const submittedPassword = String(fd.get("password") ?? password);
    const result = await signIn("admin", {
      email: submittedEmail,
      password: submittedPassword,
      redirect: false,
    });
    if (result?.error) {
      setError(
        result.error === "Configuration"
          ? "Error de configuración del servidor de acceso. Si persiste, avisá a soporte."
          : "Email o contraseña incorrectos",
      );
      setLoading(false);
      return;
    }
    saveLastAdminEmail(submittedEmail);
    // Keep "Ingresando…" and hard-nav so callback loads with session (no Router Cache).
    window.location.assign(callbackUrl);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmailDraft(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Spinner className="mr-2 text-white" />
            Ingresando…
          </>
        ) : (
          "Ingresar"
        )}
      </Button>
    </form>
  );
}
