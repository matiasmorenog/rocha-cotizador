import { CustomerModuleEnter } from "@/components/customer/customer-module-enter";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CustomerModuleEnter>{children}</CustomerModuleEnter>;
}
