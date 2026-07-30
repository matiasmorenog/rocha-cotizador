import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWhatsAppNotifyDigits } from "@/lib/business-settings";
import { db } from "@/lib/db";
import {
  effectiveDiscountPriceListId,
  getPriceListUnitPricesByProductId,
} from "@/lib/price-list-resolve";
import { unitPriceForProduct } from "@/lib/pricing";
import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import { quoteLineMeasureLabel } from "@/lib/order-measure";
import { formatPrice, formatQty } from "@/lib/utils";
import {
  buildQuoteWhatsAppMessage,
  whatsappUrl,
} from "@/lib/whatsapp";
import { BrandLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/quote/print-button";
import { RemitoAdminTable } from "@/components/quote/remito-admin-table";
import {
  RemitoEditModeProvider,
  RemitoEditModeToggle,
} from "@/components/quote/remito-edit-mode";
import { WhatsAppNotifyButton } from "@/components/quote/whatsapp-notify-button";
import { DataTableScroll } from "@/components/ui/data-table";
import {
  formatDeliveryDateLabel,
} from "@/lib/delivery-date";

export const dynamic = "force-dynamic";

export default async function RemitoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ whatsapp?: string }>;
}) {
  const { id } = await params;
  const { whatsapp } = await searchParams;
  const session = await auth();

  // WhatsApp / shared links: never 404 when logged out — choose cliente/admin.
  if (!session?.user) {
    const next = encodeURIComponent(`/remitos/${id}`);
    redirect(`/entrar?callbackUrl=${next}`);
  }

  if (session.user.role !== "CUSTOMER" && session.user.role !== "ADMIN") {
    notFound();
  }

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          code: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          deliveryHours: true,
          priceListId: true,
        },
      },
      items: { orderBy: { productCode: "asc" } },
    },
  });
  if (!quote) notFound();

  const productIds = quote.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, allowsUnitOrder: true, basePrice: true },
        })
      : [];
  const allowsUnitOrderByProductId = new Map(
    products.map((p) => [p.id, p.allowsUnitOrder]),
  );

  // Same $/kg as ordering by kg (customer list override → basePrice).
  const discountListId = await effectiveDiscountPriceListId(
    quote.customer.priceListId,
  );
  const listOverrides =
    discountListId != null
      ? await getPriceListUnitPricesByProductId(discountListId)
      : null;
  const kgPriceByProductId = new Map<string, number>();
  for (const p of products) {
    kgPriceByProductId.set(
      p.id,
      Number(
        unitPriceForProduct(p.basePrice, listOverrides?.get(p.id) ?? null),
      ),
    );
  }

  if (
    session.user.role === "CUSTOMER" &&
    quote.customerId !== session.user.customerId
  ) {
    notFound();
  }

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin =
    (host ? `${proto}://${host}` : null) ??
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "";
  const remitoUrl = `${origin}/remitos/${quote.id}`;
  const notifyDigits = await getWhatsAppNotifyDigits();
  const notifyWhatsappUrl = whatsappUrl(
    notifyDigits,
    buildQuoteWhatsAppMessage({
      quoteNumber: quote.number,
      customerCode: quote.customer.code,
      customerName: quote.customer.name,
      totalLabel: formatPrice(quote.total),
      notes: quote.notes,
      deliveryDate: quote.deliveryDate,
      remitoUrl,
    }),
  );
  const showWhatsappCta = whatsapp === "1" && Boolean(notifyWhatsappUrl);
  const deliveryLabel = formatDeliveryDateLabel(quote.deliveryDate);
  const isAdmin = session.user.role === "ADMIN";
  const pendingWeighCount = quote.items.filter(
    (item) => item.orderByUnit || Number(item.unitPrice) === 0,
  ).length;
  const canDeleteLine = quote.items.length > 1;

  const adminLines = isAdmin
    ? quote.items.map((item) => {
        const allowsUnitOrder = item.productId
          ? (allowsUnitOrderByProductId.get(item.productId) ?? false)
          : false;
        const needsWeighPrice =
          item.orderByUnit || Number(item.unitPrice) === 0;
        return {
          itemId: item.id,
          productCode: item.productCode,
          productName: item.productName,
          qty: Number(item.qty),
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
          measureLabel: quoteLineMeasureLabel(
            item.orderByUnit,
            allowsUnitOrder,
          ),
          needsWeighPrice,
          isWeighConfirmProduct: allowsUnitOrder,
          suggestedKgPrice: item.productId
            ? (kgPriceByProductId.get(item.productId) ?? 0)
            : 0,
          orderedByUnit: item.orderByUnit,
        };
      })
    : [];

  const pageBody = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Remito {quote.number}</h1>
          <p className="text-sm text-neutral-600">
            {quote.createdAt.toLocaleString("es-AR")}
          </p>
          <p className="text-sm text-neutral-700">
            Entrega: {deliveryLabel}
          </p>
          {isAdmin && pendingWeighCount > 0 ? (
            <p className="mt-1 text-sm text-amber-800">
              {pendingWeighCount === 1
                ? "1 línea pendiente de precio tras pesaje"
                : `${pendingWeighCount} líneas pendientes de precio tras pesaje`}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={session.user.role === "ADMIN" ? "/admin/cotizaciones" : "/remitos"}
            className="inline-flex h-10 items-center rounded-md border border-neutral-300 bg-white px-4 text-sm"
          >
            Volver
          </Link>
          <PrintButton />
          {isAdmin ? <RemitoEditModeToggle /> : null}
        </div>
      </div>

      {showWhatsappCta && notifyWhatsappUrl ? (
        <WhatsAppNotifyButton whatsappUrl={notifyWhatsappUrl} autoOpen />
      ) : null}

      <article className="print-remito rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <BrandLogo size="md" className="h-20 w-auto print:h-24" />
            <h2 className="mt-3 text-xl font-semibold">Remito {quote.number}</h2>
            <p className="text-sm text-neutral-600">
              Fecha: {quote.createdAt.toLocaleDateString("es-AR")}
            </p>
            <p className="text-sm font-medium text-neutral-800">
              Entrega: {deliveryLabel}
            </p>
          </div>
          <div className="text-sm text-neutral-800">
            <p className="font-semibold">
              {quote.customer.code} — {quote.customer.name}
            </p>
            {quote.customer.address ? <p>{quote.customer.address}</p> : null}
            {quote.customer.phone ? <p>Tel: {quote.customer.phone}</p> : null}
            {quote.customer.email ? <p>Email: {quote.customer.email}</p> : null}
            {quote.customer.deliveryHours ? (
              <p>Hs. entrega: {quote.customer.deliveryHours}</p>
            ) : null}
          </div>
        </header>

        {isAdmin ? (
          <RemitoAdminTable
            quoteId={quote.id}
            lines={adminLines}
            canDeleteLine={canDeleteLine}
          />
        ) : (
          <DataTableScroll className="rounded-none border-0 bg-transparent">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-neutral-600">
                  <th className="py-2 pl-2 pr-2 font-medium">Cód.</th>
                  <th className="py-2 pr-2 font-medium">Cant.</th>
                  <th className="py-2 pr-2 font-medium">Artículo</th>
                  <th className="py-2 pr-2 text-right font-medium">Precio</th>
                  <th className="py-2 pr-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item) => {
                  const allowsUnitOrder = item.productId
                    ? (allowsUnitOrderByProductId.get(item.productId) ?? false)
                    : false;
                  const needsWeighPrice =
                    item.orderByUnit || Number(item.unitPrice) === 0;
                  const isWeighConfirmProduct = allowsUnitOrder;
                  const showAmber = needsWeighPrice || isWeighConfirmProduct;
                  const measureLabel = quoteLineMeasureLabel(
                    item.orderByUnit,
                    allowsUnitOrder,
                  );

                  return (
                    <tr
                      key={item.id}
                      className={
                        showAmber
                          ? "border-b border-amber-200 bg-amber-50"
                          : "border-b border-neutral-100"
                      }
                    >
                      <td className="py-2 pl-2 pr-2 align-middle font-mono text-xs">
                        {item.productCode}
                      </td>
                      <td className="py-2 pr-2 align-middle">
                        {formatQty(item.qty)}{" "}
                        <span className="text-neutral-500">{measureLabel}</span>
                      </td>
                      <td className="py-2 pr-2 align-middle">
                        <div>{item.productName}</div>
                        {needsWeighPrice ? (
                          <p className="mt-0.5 text-xs text-amber-800">
                            {UNIT_ORDER_PRICE_WARNING}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-right align-middle">
                        {formatPrice(item.unitPrice)}
                      </td>
                      <td className="py-2 pr-2 text-right align-middle font-medium">
                        {formatPrice(item.lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableScroll>
        )}

        {quote.notes ? (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Observaciones
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
              {quote.notes}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <p className="text-lg font-semibold">
            Total: {formatPrice(quote.total)}
          </p>
        </div>
      </article>
    </div>
  );

  if (isAdmin) {
    return <RemitoEditModeProvider>{pageBody}</RemitoEditModeProvider>;
  }

  return pageBody;
}
