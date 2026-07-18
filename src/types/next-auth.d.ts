import type { AppRole } from "./auth";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    customerId?: string | null;
    customerCode?: string | null;
    email?: string | null;
    name?: string | null;
    mustChangePassword?: boolean;
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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    customerId?: string | null;
    customerCode?: string | null;
    mustChangePassword?: boolean;
  }
}
