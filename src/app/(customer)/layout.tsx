import { CustomerPromoFooter } from "@/components/customer/customer-promo-footer";
import { getOptionalSession } from "@/lib/session";
import { isAdminPanelRole } from "@/lib/staff-permissions";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();
  const showPromo =
    session?.user?.role === "CUSTOMER" && !isAdminPanelRole(session.user.role);

  return (
    <>
      {children}
      {showPromo ? <CustomerPromoFooter /> : null}
    </>
  );
}
