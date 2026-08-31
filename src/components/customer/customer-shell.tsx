import { CustomerPromoFooter } from "@/components/customer/customer-promo-footer";
import { CustomerNav } from "@/components/customer/customer-nav";
import { resolveCustomerModulesForSession } from "@/lib/customer-modules";
import { getOptionalSession } from "@/lib/session";
import type { CustomerModuleSession } from "@/types/auth";

export async function CustomerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();
  const customerId = session?.user?.customerId;
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !customerId
  ) {
    return <>{children}</>;
  }

  const modules = (await resolveCustomerModulesForSession(
    customerId,
    session.user.modules,
  )) as CustomerModuleSession[];

  return (
    <>
      <div className="admin-shell">
        <CustomerNav
          modules={modules}
          userName={session.user.name}
          customerCode={session.user.customerCode}
        />
        <div className="min-w-0 w-full flex-1">{children}</div>
      </div>
      <CustomerPromoFooter />
    </>
  );
}
