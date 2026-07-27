"use client";

import { useSession } from "next-auth/react";
import { ChangeEmailForm } from "@/components/account/change-email-form";

type Props = {
  currentEmail: string;
};

/** Admin account email change — refreshes JWT after success. */
export function AdminChangeEmailForm({ currentEmail }: Props) {
  const { update } = useSession();

  return (
    <ChangeEmailForm
      currentEmail={currentEmail}
      apiPath="/api/admin/account/email"
      onSuccess={async (email) => {
        const next = await update({ email });
        if (!next?.user || next.user.email?.toLowerCase() !== email) {
          throw new Error(
            "Se guardó en el servidor pero la sesión no se actualizó. Recargá la página.",
          );
        }
      }}
    />
  );
}
