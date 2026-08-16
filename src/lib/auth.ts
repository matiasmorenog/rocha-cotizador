import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getEnabledModulesForCustomer } from "@/lib/customer-modules";
import {
  isStaffRole,
  permissionsForRole,
} from "@/lib/staff-permissions";
import { padCustomerCode } from "@/lib/utils";
import type { AppRole, CustomerModuleSession, StaffRole } from "@/types/auth";

export type { AppRole };

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  // Unique cookie so localhost:3000 sessions from other Auth.js apps
  // (e.g. nexus-web-store) don't collide → "no matching decryption secret".
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-rocha-cotizador.session-token"
          : "rocha-cotizador.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        try {
          // Single round-trip: cold Neon + bcrypt already tight vs Vercel default maxDuration.
          const user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              role: true,
              active: true,
              inAppNotificationsEnabled: true,
            },
          });
          if (!user?.passwordHash || !user.active || !isStaffRole(user.role)) {
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          const staffRole = user.role as StaffRole;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: staffRole,
            customerId: null,
            customerCode: null,
            mustChangePassword: false,
            inAppNotificationsEnabled: user.inAppNotificationsEnabled !== false,
            modules: [],
            permissions: permissionsForRole(staffRole),
          };
        } catch (err) {
          console.error("[auth] admin authorize failed", err);
          return null;
        }
      },
    }),
    Credentials({
      id: "customer",
      name: "Customer",
      credentials: {
        code: { label: "Código", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const code = padCustomerCode(String(credentials?.code ?? ""));
        const password = String(credentials?.password ?? "");
        if (!/^\d{3}$/.test(code) || password.length < 1) return null;

        // One round-trip: customer + enabled modules (Neon cold + bcrypt budget).
        const customer = await db.customer.findUnique({
          where: { code },
          select: {
            id: true,
            name: true,
            code: true,
            active: true,
            passwordHash: true,
            mustChangePassword: true,
            moduleAccess: {
              where: { enabled: true },
              select: { module: true },
            },
          },
        });
        if (!customer || !customer.active) return null;

        const valid = await bcrypt.compare(password, customer.passwordHash);
        if (!valid) return null;

        const modules = customer.moduleAccess.map(
          (r) => r.module,
        ) as CustomerModuleSession[];

        return {
          id: customer.id,
          email: null,
          name: customer.name,
          role: "CUSTOMER" as const,
          customerId: customer.id,
          customerCode: customer.code,
          mustChangePassword: customer.mustChangePassword,
          modules,
          permissions: [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.customerId = user.customerId ?? null;
        token.customerCode = user.customerCode ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
        token.inAppNotificationsEnabled =
          user.inAppNotificationsEnabled ?? true;
        token.modules = user.modules ?? [];
        token.permissions = user.permissions ?? [];
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      if (trigger === "update") {
        if (token.customerId) {
          const customer = await db.customer.findUnique({
            where: { id: String(token.customerId) },
            select: { mustChangePassword: true },
          });
          token.mustChangePassword = customer?.mustChangePassword ?? false;
          try {
            token.modules = (await getEnabledModulesForCustomer(
              String(token.customerId),
            )) as CustomerModuleSession[];
          } catch {
            // keep existing
          }
        }
        if (token.role && isStaffRole(String(token.role))) {
          token.permissions = permissionsForRole(token.role as StaffRole);
        }
        if (
          session &&
          typeof (session as { inAppNotificationsEnabled?: unknown })
            .inAppNotificationsEnabled === "boolean"
        ) {
          token.inAppNotificationsEnabled = (
            session as { inAppNotificationsEnabled: boolean }
          ).inAppNotificationsEnabled;
        }
        if (
          session &&
          typeof (session as { email?: unknown }).email === "string"
        ) {
          token.email = (session as { email: string }).email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const role = (token.role as AppRole) ?? "CUSTOMER";
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          role,
          customerId:
            typeof token.customerId === "string" ? token.customerId : null,
          customerCode:
            typeof token.customerCode === "string" ? token.customerCode : null,
          mustChangePassword: Boolean(token.mustChangePassword),
          inAppNotificationsEnabled: token.inAppNotificationsEnabled !== false,
          email: typeof token.email === "string" ? token.email : null,
          name: typeof token.name === "string" ? token.name : null,
          modules: Array.isArray(token.modules)
            ? (token.modules as CustomerModuleSession[])
            : [],
          permissions: isStaffRole(role)
            ? permissionsForRole(role)
            : Array.isArray(token.permissions)
              ? token.permissions
              : [],
        },
      };
    },
  },
});
