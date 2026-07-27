import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { padCustomerCode } from "@/lib/utils";
import type { AppRole } from "@/types/auth";

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

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash || user.role !== "ADMIN") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Prefer column from findUnique; raw fallback if PrismaClient is stale
        // after schema push (field missing on in-memory client).
        let inAppNotificationsEnabled = user.inAppNotificationsEnabled;
        if (typeof inAppNotificationsEnabled !== "boolean") {
          const rows = await db.$queryRaw<
            Array<{ inAppNotificationsEnabled: boolean }>
          >`
            SELECT "inAppNotificationsEnabled"
            FROM "User"
            WHERE id = ${user.id}
          `;
          inAppNotificationsEnabled =
            rows[0]?.inAppNotificationsEnabled ?? true;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: "ADMIN" as const,
          customerId: null,
          customerCode: null,
          mustChangePassword: false,
          inAppNotificationsEnabled,
        };
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

        const customer = await db.customer.findUnique({ where: { code } });
        if (!customer || !customer.active) return null;

        const valid = await bcrypt.compare(password, customer.passwordHash);
        if (!valid) return null;

        return {
          id: customer.id,
          email: null,
          name: customer.name,
          role: "CUSTOMER" as const,
          customerId: customer.id,
          customerCode: customer.code,
          mustChangePassword: customer.mustChangePassword,
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
        }
        // After PATCH: client passes value — refresh JWT without another DB read.
        if (
          session &&
          typeof (session as { inAppNotificationsEnabled?: unknown })
            .inAppNotificationsEnabled === "boolean"
        ) {
          token.inAppNotificationsEnabled = (
            session as { inAppNotificationsEnabled: boolean }
          ).inAppNotificationsEnabled;
        }
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          role: (token.role as AppRole) ?? "CUSTOMER",
          customerId:
            typeof token.customerId === "string" ? token.customerId : null,
          customerCode:
            typeof token.customerCode === "string" ? token.customerCode : null,
          mustChangePassword: Boolean(token.mustChangePassword),
          // Missing on old JWTs → default true (matches DB default).
          inAppNotificationsEnabled: token.inAppNotificationsEnabled !== false,
          email: typeof token.email === "string" ? token.email : null,
          name: typeof token.name === "string" ? token.name : null,
        },
      };
    },
  },
});
