import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { MainRoutePending } from "@/components/main-route-pending";
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
        <Providers isStaff={isStaff}>
          <AppHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            <MainRoutePending>{children}</MainRoutePending>
          </main>
        </Providers>
      </body>
    </html>
  );
}
