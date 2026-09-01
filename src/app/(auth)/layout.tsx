import { BrandBackdrop } from "@/components/brand-backdrop";
import { LoginSessionShell } from "@/components/auth/login-session-shell";

export default function AuthSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandBackdrop className="mx-auto flex min-h-[60vh] max-w-md items-center py-4">
      <LoginSessionShell>{children}</LoginSessionShell>
    </BrandBackdrop>
  );
}
