"use client";

import { useSession } from "next-auth/react";
import { ChangeEmailForm } from "@/components/account/change-email-form";
import { saveLastAdminEmail } from "@/lib/last-login";

type Props = {
  currentEmail: string;
  className?: string;
};

/** Admin account email change — refreshes JWT after success. */
export function AdminChangeEmailForm({ currentEmail, className }: Props) {
  const { update } = useSession();

  return (
    <ChangeEmailForm
      currentEmail={currentEmail}
      className={className}
      apiPath="/api/admin/account/email"
      onSuccess={async (email) => {
        const next = await update({ email });
        if (!next?.user || next.user.email?.toLowerCase() !== email) {
          throw new Error(
            "Se guardó en el servidor pero la sesión no se actualizó. Recargá la página.",
          );
        }
        saveLastAdminEmail(email);
      }}
    />
  );
}
