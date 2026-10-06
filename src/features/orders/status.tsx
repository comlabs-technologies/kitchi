import { Badge } from "@/components/ui/badge";
import type { Order, OrderStatus, OrderType } from "@/types/domain";

export const STATUS_LABEL: Record<OrderStatus, string> = { OPEN: "Open", PREPARING: "Preparing", READY: "Ready", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const TYPE_LABEL: Record<OrderType, string> = { DINE_IN: "Dine in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === "COMPLETED" ? "ok" : status === "READY" ? "brand" : status === "PREPARING" ? "warn" : status === "CANCELLED" ? "danger" : "neutral";
  return <Badge tone={tone} dot>{STATUS_LABEL[status]}</Badge>;
}

export function paymentLabel(o: Pick<Order, "payments" | "paymentStatus" | "status">): string {
  if (o.status === "CANCELLED") return "—";
  if (o.paymentStatus !== "PAID") return "Unpaid";
  const m = [...new Set(o.payments.map((p) => p.method))];
  return m.map((x) => (x === "UPI" ? "UPI" : x === "CASH" ? "Cash" : "Card")).join(" + ");
}
