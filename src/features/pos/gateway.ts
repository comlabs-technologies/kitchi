"use client";
import { useSyncExternalStore } from "react";
import type { SubmitOrderInput } from "@/lib/schemas";
import { submitOrderAction, type SubmittedOrder } from "@/server/actions/pos";

/**
 * Order gateway: the POS never calls the network directly.
 *
 *   POS UI → OrderGateway.submit → (online) server action
 *                                → (offline / transport error) local queue → SyncService.flush → server
 *
 * Submissions carry a client-generated `clientRef`, and the server is idempotent on it, so a retry
 * after a dropped response can't create a duplicate order.
 */
const KEY = "kitchi.order-queue.v1";
const EVENT = "kitchi:queue";

export interface QueuedOrder {
  clientRef: string;
  payload: SubmitOrderInput;
  queuedAt: number;
}

function read(): QueuedOrder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedOrder[];
  } catch {
    return [];
  }
}
function write(list: QueuedOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: nothing more we can do offline */
  }
  window.dispatchEvent(new Event(EVENT));
}

export const orderQueue = {
  list: read,
  push(item: QueuedOrder) {
    const l = read().filter((x) => x.clientRef !== item.clientRef);
    write([...l, item]);
  },
  remove(ref: string) {
    write(read().filter((x) => x.clientRef !== ref));
  },
};

export type SubmitOutcome =
  | { status: "synced"; order: SubmittedOrder }
  | { status: "queued" }
  | { status: "error"; error: string };

export async function submitViaGateway(payload: SubmitOrderInput): Promise<SubmitOutcome> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    orderQueue.push({ clientRef: payload.clientRef, payload, queuedAt: Date.now() });
    return { status: "queued" };
  }
  try {
    const res = await submitOrderAction(payload);
    if (res.ok) return { status: "synced", order: res.data };
    return { status: "error", error: res.error };
  } catch {
    orderQueue.push({ clientRef: payload.clientRef, payload, queuedAt: Date.now() });
    return { status: "queued" };
  }
}

let flushing = false;
/** Replays queued orders in order. Stops at the first transport failure; drops items the server rejects. */
export async function flushQueue(): Promise<{ synced: number; dropped: number }> {
  if (flushing) return { synced: 0, dropped: 0 };
  flushing = true;
  let synced = 0, dropped = 0;
  try {
    for (const item of read()) {
      try {
        const res = await submitOrderAction(item.payload);
        orderQueue.remove(item.clientRef);
        if (res.ok) synced++;
        else dropped++;
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, dropped };
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
let cache: { raw: string; n: number } = { raw: "", n: 0 };
const snapshot = () => {
  const raw = localStorage.getItem(KEY) ?? "[]";
  if (raw !== cache.raw) cache = { raw, n: read().length };
  return cache.n;
};
export function useQueuedCount(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
