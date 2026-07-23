"use client";

import { useSession } from "next-auth/react";
import { ChangePasswordForm } from "@/components/account/change-password-form";

/** Customer account password change — refreshes JWT pin flag after success. */
export function CustomerChangePasswordForm() {
  const { update } = useSession();

  return (
    <ChangePasswordForm
      apiPath="/api/account/password"
      showPinHint
      onSuccess={async () => {
        try {
          sessionStorage.removeItem("rocha-pin-hint-dismissed");
        } catch {
          /* ignore */
        }
        await update();
      }}
    />
  );
}
