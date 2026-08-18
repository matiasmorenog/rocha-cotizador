import { UNIT_ORDER_PRICE_WARNING } from "@/lib/unit-order-products";
import { formatPrice, formatQty } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ThermalRemitoLine = {
  itemId: string;
  productCode: string;
  productName: string;
  qty: number | string | { toNumber?: () => number; toString: () => string };
  measureLabel: string;
  unitPrice: number | string | { toNumber?: () => number; toString: () => string };
  lineTotal: number | string | { toNumber?: () => number; toString: () => string };
  needsWeighPrice?: boolean;
};

export type ThermalRemitoReceiptProps = {
  quoteNumber: string;
  createdAt: Date;
  deliveryLabel: string;
  customer: {
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    deliveryHours?: string | null;
  };
  lines: ThermalRemitoLine[];
  total: number | string | { toNumber?: () => number; toString: () => string };
  notes?: string | null;
  className?: string;
};

/** Compact 80mm receipt layout — hidden on screen, shown only for thermal print. */
export function ThermalRemitoReceipt({
  quoteNumber,
  createdAt,
  deliveryLabel,
  customer,
  lines,
  total,
  notes,
  className,
}: ThermalRemitoReceiptProps) {
  return (
    <article
      className={cn(
        "remito-thermal-only remito-thermal-receipt print-remito",
        className,
      )}
      aria-hidden
    >
      <header className="remito-thermal-header">
        <p className="remito-thermal-brand">ROCHA</p>
        <p className="remito-thermal-title">Remito {quoteNumber}</p>
        <p>Fecha: {createdAt.toLocaleDateString("es-AR")}</p>
        <p>Entrega: {deliveryLabel}</p>
      </header>

      <section className="remito-thermal-section">
        <p className="remito-thermal-customer">
          {customer.code} — {customer.name}
        </p>
        {customer.address ? <p>{customer.address}</p> : null}
        {customer.phone ? <p>Tel: {customer.phone}</p> : null}
        {customer.email ? <p>Email: {customer.email}</p> : null}
        {customer.deliveryHours ? (
          <p>Hs. entrega: {customer.deliveryHours}</p>
        ) : null}
      </section>

      <div className="remito-thermal-divider" role="presentation" />

      <section className="remito-thermal-lines" aria-label="Artículos">
        {lines.map((line) => (
          <div key={line.itemId} className="remito-thermal-line">
            <p className="remito-thermal-line-name">
              <span className="remito-thermal-code">{line.productCode}</span>{" "}
              {line.productName}
            </p>
            <p className="remito-thermal-line-qty">
              Cant: {formatQty(line.qty)} {line.measureLabel}
            </p>
            <p className="remito-thermal-line-price">
              {formatPrice(line.unitPrice)} × {formatQty(line.qty)} ={" "}
              <strong>{formatPrice(line.lineTotal)}</strong>
            </p>
            {line.needsWeighPrice ? (
              <p className="remito-thermal-warning">{UNIT_ORDER_PRICE_WARNING}</p>
            ) : null}
          </div>
        ))}
      </section>

      <div className="remito-thermal-divider" role="presentation" />

      <footer className="remito-thermal-footer">
        {notes ? (
          <>
            <p className="remito-thermal-notes-label">Observaciones</p>
            <p className="remito-thermal-notes">{notes}</p>
          </>
        ) : null}
        <p className="remito-thermal-total">Total: {formatPrice(total)}</p>
      </footer>
    </article>
  );
}
