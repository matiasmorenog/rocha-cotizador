import type { AppRole } from "./auth";

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
  }
}
