"use server";
import { submitOrderSchema, customerSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import { requireAction } from "@/server/auth/session";
import { createCustomer, searchCustomers } from "@/server/services/customers";
import { payOrder, submitOrder, cancelOrder, completeOrder, advanceKitchen, bumpServed } from "@/server/services/orders";
import { paymentMethodSchema } from "@/lib/schemas";
import { z } from "zod";
import type { Order } from "@/types/domain";
import { safe } from "./safe";

export interface SubmittedOrder {
  order: Order;
  created: boolean;
}

export async function submitOrderAction(raw: unknown): Promise<ActionResult<SubmittedOrder>> {
  return safe(async () => {
    const ctx = await requireAction("pos.use");
    const input = submitOrderSchema.parse(raw);
    const { order, created } = submitOrder(ctx, input);
    return { order: structuredClone(order), created };
  });
}

const payLines = z.array(z.object({ method: paymentMethodSchema, amount: z.number().int().min(1), tendered: z.number().int().optional() })).min(1);

export async function payOrderAction(orderId: string, lines: unknown): Promise<ActionResult<Order>> {
  return safe(async () => {
    const ctx = await requireAction("pos.use");
    return structuredClone(payOrder(ctx, orderId, payLines.parse(lines)));
  });
}

export async function searchCustomersAction(q: string) {
  const ctx = await requireAction("pos.use");
  return searchCustomers(ctx, q);
}

export async function createCustomerAction(raw: unknown) {
  return safe(async () => createCustomer(await requireAction("pos.use"), customerSchema.parse(raw)));
}

export async function cancelOrderAction(id: string, reason: string) {
  return safe(async () => void cancelOrder(await requireAction("orders.manage"), id, reason));
}
export async function completeOrderAction(id: string) {
  return safe(async () => void completeOrder(await requireAction("orders.manage"), id));
}
export async function advanceKitchenAction(id: string) {
  return safe(async () => void advanceKitchen(await requireAction("kitchen.manage"), id));
}
export async function bumpServedAction(id: string) {
  return safe(async () => void bumpServed(await requireAction("kitchen.manage"), id));
}
