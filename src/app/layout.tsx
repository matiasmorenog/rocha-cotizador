import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { CustomerLayoutFrame } from "@/components/customer/customer-layout-frame";
import type { CustomerLayoutFrameUser } from "@/components/customer/customer-layout-frame";
import { Providers } from "@/components/providers";
import { adminThemeBlockingScript } from "@/lib/admin-theme";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole } from "@/lib/staff-permissions";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rocha Cotizador",
  description: "Cotizador mayorista de productos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getOptionalSession();
  const isStaff = isAdminPanelRole(session?.user?.role);
  const customerFrameUser: CustomerLayoutFrameUser | null =
    session?.user?.role === "CUSTOMER" && session.user.customerId
      ? {
          modules: (session.user.modules ?? []) as CustomerLayoutFrameUser["modules"],
          userName: session.user.name,
          customerCode: session.user.customerCode,
        }
      : null;

  return (
    <html
      lang="es"
      className={`${sourceSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: adminThemeBlockingScript(isStaff) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers isStaff={isStaff} session={session}>
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            <CustomerLayoutFrame customerUser={customerFrameUser}>
              {children}
            </CustomerLayoutFrame>
          </main>
        </Providers>
      </body>
    </html>
  );
}
