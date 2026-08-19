import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getEnabledModulesForCustomer } from "@/lib/customer-modules";
import {
  ALL_PERMISSIONS,
  isAdminPanelRole,
  isStaffRole,
  staffPermissionsFromProfile,
  type StaffPermission,
} from "@/lib/staff-permissions";
import {
  parseStaffPreviewPresetId,
  staffPreviewPermissions,
  staffPreviewSessionFromPresetId,
} from "@/lib/staff-preview";
import { padCustomerCode } from "@/lib/utils";
import {
  isPlatformOwnerEmail,
  isSuperuserRole,
} from "@/lib/platform-owner";
import type { AppRole, CustomerModuleSession, StaffRole } from "@/types/auth";
import type { JWT } from "next-auth/jwt";

export type { AppRole };

async function ensureSuperuserRole(user: {
  id: string;
  email: string;
  role: string;
  isSuperuser: boolean;
}): Promise<"SUPERUSER" | StaffRole> {
  const shouldBeSuperuser =
    user.role === "SUPERUSER" ||
    user.isSuperuser ||
    isPlatformOwnerEmail(user.email);

  if (!shouldBeSuperuser) {
    return user.role as StaffRole;
  }

  if (user.role !== "SUPERUSER" || !user.isSuperuser) {
    await db.user.update({
      where: { id: user.id },
      data: {
        role: "SUPERUSER",
        isSuperuser: true,
        canQuotes: false,
        canStock: false,
      },
    });
  }

  return "SUPERUSER";
}

/**
 * Keep `isSuperuser` accurate for tokens minted before the field existed, or
 * after DB/bootstrap promoted PLATFORM_OWNER_EMAIL without a fresh login.
 */
function syncSuperuserTokenIdentity(token: JWT) {
  const email = typeof token.email === "string" ? token.email : null;
  const role = typeof token.role === "string" ? token.role : null;

  if (email && isPlatformOwnerEmail(email)) {
    token.isSuperuser = true;
    if (!token.staffPreview && role !== "SUPERUSER") {
      token.role = "SUPERUSER";
      token.permissions = [...ALL_PERMISSIONS];
    }
    return;
  }

  if (token.isSuperuser !== true && isSuperuserRole(role)) {
    token.isSuperuser = true;
    return;
  }

  // Preview presets are superuser-only — recover flag if it was dropped.
  if (token.isSuperuser !== true && token.staffPreview) {
    token.isSuperuser = true;
  }
}

/** Superuser JWT: apply optional staff preview to role + permissions. */
function applyEffectiveStaffSession(token: JWT) {
  if (!token.isSuperuser) return;

  const previewId = token.staffPreview;
  if (previewId) {
    const permissions = staffPreviewPermissions(previewId);
    token.role =
      previewId === "full_admin"
        ? "ADMIN"
        : previewId === "quotes_only"
          ? "QUOTES"
          : "STOCK";
    token.permissions = permissions;
    return;
  }

  token.role = "SUPERUSER";
  token.permissions = [...ALL_PERMISSIONS];
}

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
              canQuotes: true,
              canStock: true,
              active: true,
              inAppNotificationsEnabled: true,
              isSuperuser: true,
            },
          });
          if (
            !user?.passwordHash ||
            !user.active ||
            !isAdminPanelRole(user.role)
          ) {
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          const effectiveRole = await ensureSuperuserRole(user);
          const permissions = isSuperuserRole(effectiveRole)
            ? []
            : staffPermissionsFromProfile({
                role: effectiveRole,
                canQuotes: user.canQuotes,
                canStock: user.canStock,
              });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: effectiveRole,
            customerId: null,
            customerCode: null,
            mustChangePassword: false,
            inAppNotificationsEnabled: user.inAppNotificationsEnabled !== false,
            modules: [],
            permissions,
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
        token.isSuperuser = isSuperuserRole(user.role);
        token.staffPreview = null;
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
        syncSuperuserTokenIdentity(token);
        applyEffectiveStaffSession(token);
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
        if (token.role && isAdminPanelRole(String(token.role))) {
          const dbUser = await db.user.findUnique({
            where: { id: String(token.sub) },
            select: {
              role: true,
              canQuotes: true,
              canStock: true,
              isSuperuser: true,
              email: true,
            },
          });
          if (dbUser && isAdminPanelRole(dbUser.role)) {
            const effectiveRole = await ensureSuperuserRole({
              id: String(token.sub),
              email: dbUser.email,
              role: dbUser.role,
              isSuperuser: dbUser.isSuperuser,
            });
            token.isSuperuser = isSuperuserRole(effectiveRole);
            if (token.isSuperuser) {
              token.role = "SUPERUSER";
              token.permissions = [...ALL_PERMISSIONS];
            } else {
              token.role = effectiveRole;
              token.permissions = staffPermissionsFromProfile({
                role: effectiveRole,
                canQuotes: dbUser.canQuotes,
                canStock: dbUser.canStock,
              });
            }
          }
        }
        if (
          session &&
          typeof (session as { staffPreview?: unknown }).staffPreview !==
            "undefined"
        ) {
          const previewPayload = (session as { staffPreview: unknown })
            .staffPreview;
          if (token.isSuperuser) {
            if (previewPayload === null) {
              token.staffPreview = null;
            } else {
              const presetId = parseStaffPreviewPresetId(previewPayload);
              if (presetId) token.staffPreview = presetId;
            }
          }
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
      syncSuperuserTokenIdentity(token);
      applyEffectiveStaffSession(token);
      return token;
    },
    async session({ session, token }) {
      const role = (token.role as AppRole) ?? "CUSTOMER";
      const isSuperuser = Boolean(token.isSuperuser);
      const previewId = parseStaffPreviewPresetId(token.staffPreview);
      const staffPreview =
        isSuperuser && previewId
          ? staffPreviewSessionFromPresetId(previewId)
          : null;

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
            ? Array.isArray(token.permissions)
              ? (token.permissions as StaffPermission[])
              : staffPermissionsFromProfile({
                  role,
                  canQuotes: false,
                  canStock: false,
                })
            : Array.isArray(token.permissions)
              ? (token.permissions as StaffPermission[])
              : [],
          isSuperuser,
          staffPreview,
        },
      };
    },
  },
});
