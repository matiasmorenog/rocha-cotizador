import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CustomerLoginForm } from "@/components/auth/customer-login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role === "CUSTOMER") redirect("/cotizar");
  if (session?.user?.role === "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Acceso clientes</h1>
        <p className="text-sm text-neutral-600">
          Código de cliente y contraseña (PIN inicial la primera vez)
        </p>
      </div>
      <CustomerLoginForm />
    </div>
  );
}
