import { CustomerPromoFooter } from "@/components/customer/customer-promo-footer";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CustomerPromoFooter />
    </>
  );
}
