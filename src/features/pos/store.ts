"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DiscountInput } from "@/lib/billing";
import type { FoodType, Order, OrderType } from "@/types/domain";

export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  foodType: FoodType;
  variantId?: string;
  variantName?: string;
  modifiers: { id: string; name: string; price: number }[];
  unitPrice: number;
  qty: number;
  taxRate: number;
  note?: string;
}

export interface CartCustomer {
  id: string;
  name: string;
  phone: string;
}

export interface Cart {
  lines: CartLine[];
  type: OrderType;
  tableId?: string;
  customer?: CartCustomer;
  note: string;
  discount: DiscountInput;
  /** Set when amending an order that already exists on the server (e.g. a running table). */
  orderId?: string;
  orderNumber?: number;
  clientRef: string;
}

export interface HeldOrder {
  id: string;
  heldAt: number;
  cart: Cart;
}

const newRef = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const emptyCart = (): Cart => ({ lines: [], type: "DINE_IN", note: "", discount: null, clientRef: newRef() });

export const lineKey = (l: Pick<CartLine, "menuItemId" | "variantId" | "modifiers" | "note">) =>
  [l.menuItemId, l.variantId ?? "", l.modifiers.map((m) => m.id).sort().join("+"), l.note ?? ""].join("|");

interface PosState extends Cart {
  held: HeldOrder[];
  lastAddedKey?: string;
  add: (line: Omit<CartLine, "key" | "qty"> & { qty?: number }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  setLineNote: (key: string, note: string) => void;
  setType: (t: OrderType) => void;
  setTable: (id?: string) => void;
  setCustomer: (c?: CartCustomer) => void;
  setNote: (n: string) => void;
  setDiscount: (d: DiscountInput) => void;
  reset: () => void;
  hold: () => boolean;
  recall: (id: string) => void;
  discardHeld: (id: string) => void;
  loadExisting: (o: Order, resolve: (menuItemId: string, variantName?: string) => { variantId?: string; modifierIds: Record<string, string> } | null) => void;
}

const snapshot = (s: PosState): Cart => ({ lines: s.lines, type: s.type, tableId: s.tableId, customer: s.customer, note: s.note, discount: s.discount, orderId: s.orderId, orderNumber: s.orderNumber, clientRef: s.clientRef });

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      ...emptyCart(),
      held: [],
      add: (l) =>
        set((s) => {
          const key = lineKey(l);
          const ex = s.lines.find((x) => x.key === key);
          const lines = ex ? s.lines.map((x) => (x.key === key ? { ...x, qty: Math.min(99, x.qty + (l.qty ?? 1)) } : x)) : [...s.lines, { ...l, key, qty: l.qty ?? 1 }];
          return { lines, lastAddedKey: key };
        }),
      setQty: (key, qty) => set((s) => ({ lines: qty <= 0 ? s.lines.filter((x) => x.key !== key) : s.lines.map((x) => (x.key === key ? { ...x, qty: Math.min(99, qty) } : x)) })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((x) => x.key !== key) })),
      setLineNote: (key, note) => set((s) => ({ lines: s.lines.map((x) => (x.key === key ? { ...x, note: note.trim() || undefined } : x)) })),
      setType: (type) => set((s) => ({ type, tableId: type === "DINE_IN" ? s.tableId : undefined })),
      setTable: (tableId) => set({ tableId }),
      setCustomer: (customer) => set({ customer }),
      setNote: (note) => set({ note }),
      setDiscount: (discount) => set({ discount }),
      reset: () => set({ ...emptyCart(), lastAddedKey: undefined }),
      hold: () => {
        const s = get();
        if (!s.lines.length) return false;
        set({ held: [{ id: newRef(), heldAt: Date.now(), cart: snapshot(s) }, ...s.held], ...emptyCart() });
        return true;
      },
      recall: (id) => {
        const s = get();
        const h = s.held.find((x) => x.id === id);
        if (!h) return;
        const rest = s.held.filter((x) => x.id !== id);
        set({ ...h.cart, held: s.lines.length ? [{ id: newRef(), heldAt: Date.now(), cart: snapshot(s) }, ...rest] : rest });
      },
      discardHeld: (id) => set((s) => ({ held: s.held.filter((x) => x.id !== id) })),
      loadExisting: (o, resolve) =>
        set({
          lines: o.items.map((i) => {
            const r = resolve(i.menuItemId, i.variantName);
            const base = { menuItemId: i.menuItemId, variantId: r?.variantId, modifiers: i.modifiers.map((m) => ({ id: r?.modifierIds[m.name] ?? m.name, name: m.name, price: m.price })), note: i.note };
            return { key: lineKey(base), ...base, name: i.name, foodType: i.foodType, variantName: i.variantName, unitPrice: i.unitPrice, qty: i.qty, taxRate: i.taxRate };
          }),
          type: o.type,
          tableId: o.tableId,
          customer: o.customerId ? { id: o.customerId, name: o.customerName ?? "Customer", phone: "" } : undefined,
          note: o.note ?? "",
          discount: o.discount ? { kind: "FLAT", value: o.discount } : null,
          orderId: o.id,
          orderNumber: o.number,
          clientRef: newRef(),
        }),
    }),
    {
      name: "kitchi-pos-v1",
      skipHydration: true,
      partialize: (s) => ({ ...snapshot(s), held: s.held }),
    },
  ),
);
