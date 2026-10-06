/** All money in the domain is stored as integer paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,240 — whole rupees, for most UI. */
export function formatMoney(paise: number): string {
  return inr.format(Math.round(paise / 100));
}
/** ₹1,240.50 — receipts and reports that need paise. */
export function formatMoneyPrecise(paise: number): string {
  return inrPrecise.format(paise / 100);
}
/** Compact: ₹38.4k / ₹1.2L */
export function formatMoneyCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(r >= 1000000 ? 1 : 2)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
}
