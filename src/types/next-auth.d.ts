import type { AppRole, CustomerModuleSession } from "./auth";
import type { StaffPermission } from "@/lib/staff-permissions";
import type { StaffPreviewSession } from "@/lib/staff-preview";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    customerId?: string | null;
    customerCode?: string | null;
    email?: string | null;
    name?: string | null;
    mustChangePassword?: boolean;
    /** Admin only — account-level in-app toast/poll preference. */
    inAppNotificationsEnabled?: boolean;
    /** Customer: enabled product modules. */
    modules?: CustomerModuleSession[];
    /** Staff: derived from role for nav/gates. */
    permissions?: StaffPermission[];
    /** Platform owner (developer). True even during staff preview. */
    isSuperuser?: boolean;
    /** session.update({ staffPreview }) — superuser only. */
    staffPreview?: import("@/lib/staff-preview").StaffPreviewPresetId | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: AppRole;
      customerId?: string | null;
      customerCode?: string | null;
      mustChangePassword?: boolean;
      /** Admin only — from JWT (no DB on each page). Default true. */
      inAppNotificationsEnabled?: boolean;
      modules?: CustomerModuleSession[];
      permissions?: StaffPermission[];
      isSuperuser?: boolean;
      staffPreview?: StaffPreviewSession | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    customerId?: string | null;
    customerCode?: string | null;
    mustChangePassword?: boolean;
    inAppNotificationsEnabled?: boolean;
    modules?: CustomerModuleSession[];
    permissions?: StaffPermission[];
    /** Actual platform owner flag — independent of preview role. */
    isSuperuser?: boolean;
    staffPreview?: import("@/lib/staff-preview").StaffPreviewPresetId | null;
  }
}
