import type { CustomerModule } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { customerHasModule } from "@/lib/customer-modules";
import type { CustomerModuleSession } from "@/types/auth";

export type CustomerApiContext = {
  session: Session;
  customerId: string;
};

/** Customer session with optional module gate (DB-checked). */
export async function requireCustomerModuleApi(
  module: CustomerModule,
): Promise<CustomerApiContext | null> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "CUSTOMER" ||
    !session.user.customerId
  ) {
    return null;
  }

  const modules = session.user.modules ?? [];
  if (!modules.includes(module as CustomerModuleSession)) {
    return null;
  }

  if (!(await customerHasModule(session.user.customerId, module))) {
    return null;
  }

  return { session, customerId: session.user.customerId };
}
