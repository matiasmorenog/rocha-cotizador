import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Admin</h1>
        <p className="text-sm text-neutral-600">Acceso administradores</p>
      </div>
      <AdminLoginForm />
      <p className="text-center text-xs text-neutral-500">
        <Link href="/login" className="underline">
          Volver a login cliente
        </Link>
      </p>
    </div>
  );
}
