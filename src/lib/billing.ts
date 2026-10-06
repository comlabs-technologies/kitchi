import type { OrderItem } from "@/types/domain";

export const lineTotal = (i: Pick<OrderItem, "unitPrice" | "qty">) => i.unitPrice * i.qty;

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  roundOff: number;
  total: number;
}

/**
 * Shared by the POS (optimistic UI) and the server (source of truth).
 * Prices are GST-exclusive. Discount is spread pro-rata across lines before tax.
 * Total is rounded to the nearest rupee; roundOff carries the difference.
 */
export function computeTotals(
  items: Pick<OrderItem, "unitPrice" | "qty" | "taxRate">[],
  discount = 0,
  gstEnabled = true,
): Totals {
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const d = Math.max(0, Math.min(discount, subtotal));
  let tax = 0;
  if (gstEnabled && subtotal > 0) {
    for (const i of items) {
      const net = lineTotal(i) * (1 - d / subtotal);
      tax += (net * i.taxRate) / 100;
    }
  }
  tax = Math.round(tax);
  const raw = subtotal - d + tax;
  const total = Math.round(raw / 100) * 100;
  return { subtotal, discount: d, tax, roundOff: total - raw, total };
}

export type DiscountInput = { kind: "PERCENT" | "FLAT"; value: number } | null;

/** Resolves a UI discount (percent or flat rupees→paise) into paise. */
export function resolveDiscount(subtotal: number, d: DiscountInput): number {
  if (!d || d.value <= 0) return 0;
  const v = d.kind === "PERCENT" ? Math.round((subtotal * Math.min(d.value, 100)) / 100) : d.value;
  return Math.min(v, subtotal);
}
