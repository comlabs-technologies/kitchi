import { computeTotals } from "@/lib/billing";
import { toPaise as R } from "@/lib/money";
import { DAY, HOUR, MIN, dayKey, startOfDayIST } from "@/lib/time";
import type {
  Customer,
  Employee,
  InventoryItem,
  MenuItem,
  ModifierGroup,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  RestaurantTable,
  StockMovement,
  StockReason,
} from "@/types/domain";
import { buildMenu } from "./menu-data";
import type { Store } from "./store";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rnd: () => number, list: T[], w: (t: T) => number): T {
  const total = list.reduce((s, x) => s + w(x), 0);
  let r = rnd() * total;
  for (const x of list) {
    r -= w(x);
    if (r <= 0) return x;
  }
  return list[list.length - 1]!;
}

export const DEMO = {
  org: "org_kitchi_demo",
  restaurant: "rest_demo",
  outletKP: "out_kp",
  outletBaner: "out_baner",
  owner: "usr_pawan",
  manager: "usr_aarti",
  cashier: "usr_rohan",
  chef: "usr_suresh",
} as const;

const POPULARITY: Record<string, number> = {
  "Chicken Biryani": 10, "Cold Coffee": 8, "Masala Chai": 8, "French Fries": 6, "Margherita Pizza": 6,
  "Paneer Tikka": 5, "Brownie": 4, "Butter Naan": 5, "Butter Chicken": 4, "Veg Biryani": 3,
  "Dal Makhani": 3, "Paneer Butter Masala": 3, "Cappuccino": 4, "Coke": 4, "Fresh Lime Soda": 3,
  "Farmhouse Pizza": 3, "Pepperoni Pizza": 2.5, "Chicken Tikka": 3, "Jeera Rice": 2, "Mango Lassi": 2.5,
  "Gulab Jamun": 2, "Tiramisu": 1.5, "Baked Cheesecake": 1.5, "Chilli Chicken": 2, "Veg Spring Rolls": 2,
  "Hara Bhara Kebab": 1.5, "Americano": 2, "Iced Tea": 1.5, "Grilled Chicken Sandwich": 2,
};

const FIRST = ["Aarav", "Vihaan", "Ananya", "Isha", "Rahul", "Priya", "Kunal", "Neha", "Siddharth", "Meera", "Aditya", "Riya", "Karan", "Pooja", "Varun", "Sanjana", "Tanmay", "Shruti", "Omkar", "Gauri", "Harsh", "Divya", "Yash", "Nidhi", "Rohit", "Kavya", "Amit", "Sakshi", "Mihir", "Tanvi", "Akash", "Rutuja", "Chinmay", "Aishwarya", "Prasad", "Mrunal", "Dhruv", "Simran", "Jay", "Swati"];
const LAST = ["Kulkarni", "Deshpande", "Joshi", "Patil", "Sharma", "Mehta", "Iyer", "Nair", "Gupta", "Shah", "Bhosale", "Jadhav", "Kapoor", "Menon", "Pawar", "Rao", "Khanna", "Chavan", "Ghosh", "Singh"];

export function seedDemo(s: Store, now = Date.now()) {
  const rnd = mulberry32(20261006);
  const today = startOfDayIST(now);

  // ── Tenant ────────────────────────────────────────────────
  s.organizations.push({ id: DEMO.org, name: "Kitchi Account", plan: "GROWTH", createdAt: now - 90 * DAY });
  s.restaurants.push({
    id: DEMO.restaurant, organizationId: DEMO.org, name: "Kitchi Demo Café", type: "CAFE", legalName: "Kitchi Demo Hospitality LLP",
    gstEnabled: true, gstin: "27AAKFK1234F1Z5", defaultTaxRate: 5, pricesIncludeTax: false,
    setup: { menu: true, tables: true, tax: true, firstOrder: true }, createdAt: now - 90 * DAY,
  });
  s.outlets.push(
    { id: DEMO.outletKP, organizationId: DEMO.org, restaurantId: DEMO.restaurant, name: "Koregaon Park", city: "Pune", address: "Lane 6, North Main Road, Koregaon Park, Pune 411001", phone: "+91 20 4120 8890", fssai: "11521998000123", createdAt: now - 90 * DAY },
    { id: DEMO.outletBaner, organizationId: DEMO.org, restaurantId: DEMO.restaurant, name: "Baner", city: "Pune", address: "Baner Road, near Balewadi Phata, Pune 411045", phone: "+91 20 4120 8891", fssai: "11521998000456", createdAt: now - 40 * DAY },
  );
  const users: [string, string, string, "OWNER" | "MANAGER" | "CASHIER" | "CHEF", string[]][] = [
    [DEMO.owner, "Pawan Deshmukh", "pawan@kitchidemo.in", "OWNER", [DEMO.outletKP, DEMO.outletBaner]],
    [DEMO.manager, "Aarti Joshi", "aarti@kitchidemo.in", "MANAGER", [DEMO.outletKP]],
    [DEMO.cashier, "Rohan Mehta", "rohan@kitchidemo.in", "CASHIER", [DEMO.outletKP]],
    [DEMO.chef, "Suresh Nair", "suresh@kitchidemo.in", "CHEF", [DEMO.outletKP]],
  ];
  for (const [id, name, email, role, outletIds] of users) {
    s.users.push({ id, name, email, createdAt: now - 90 * DAY });
    s.memberships.push({ id: `mem_${id}`, userId: id, organizationId: DEMO.org, restaurantId: DEMO.restaurant, outletIds, role });
  }

  // ── Menu ──────────────────────────────────────────────────
  const menu = buildMenu(DEMO.restaurant, now);
  s.categories.push(...menu.categories);
  s.modifierGroups.push(...menu.groups);
  s.menuItems.push(...menu.items);

  // ── Customers ─────────────────────────────────────────────
  const customers: Customer[] = [];
  for (let i = 0; i < 44; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`;
    customers.push({
      id: `cus_${i}`, restaurantId: DEMO.restaurant, name,
      phone: `+91 9${String(Math.floor(rnd() * 1e4)).padStart(4, "0")} ${String(Math.floor(rnd() * 1e5)).padStart(5, "0")}`,
      email: i % 3 === 0 ? `${name.split(" ")[0]!.toLowerCase()}@example.com` : undefined,
      createdAt: now - Math.floor(rnd() * 80) * DAY,
    });
  }
  s.customers.push(...customers);

  // ── Per-outlet operations ─────────────────────────────────
  const staffNames: Record<string, string[]> = {
    [DEMO.outletKP]: ["Rohan Mehta", "Sneha Patil", "Imran Shaikh", "Kavita More"],
    [DEMO.outletBaner]: ["Nikhil Shah", "Vikram Rao"],
  };
  seedTables(s, DEMO.outletKP, 12, now);
  seedTables(s, DEMO.outletBaner, 8, now);
  seedInventory(s, DEMO.outletKP, 1, rnd, now);
  seedInventory(s, DEMO.outletBaner, 0.7, rnd, now);
  seedEmployees(s);
  for (const o of [DEMO.outletKP, DEMO.outletBaner]) {
    s.outletSettings.push({
      outletId: o, acceptUpi: true, acceptCash: true, acceptCard: true, upiId: "kitchidemo@okaxis",
      receiptFooter: "Thank you for dining with us. See you soon!", autoPrintKot: true, kotPrinter: "Kitchen Printer (browser)", receiptPrinter: "Counter Printer (browser)",
    });
  }

  const scale: Record<string, { k: number; days: number }> = {
    [DEMO.outletKP]: { k: 1, days: 30 },
    [DEMO.outletBaner]: { k: 0.5, days: 14 },
  };
  for (const outletId of [DEMO.outletKP, DEMO.outletBaner]) {
    generateHistory(s, outletId, scale[outletId]!, menu.items, menu.groups, customers, staffNames[outletId]!, rnd, now, today);
    generateLive(s, outletId, menu.items, menu.groups, staffNames[outletId]!, rnd, now);
    numberOrders(s, outletId);
  }
}

// ── Tables ──────────────────────────────────────────────────
export function seedTables(s: Store, outletId: string, count: number, _now: number) {
  const tables: RestaurantTable[] = [];
  for (let i = 1; i <= count; i++) {
    const patio = count > 8 && i > 8;
    tables.push({
      id: `${outletId}_t${i}`, outletId, name: `T${i}`, seats: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      section: patio ? "Patio" : "Main hall", status: "AVAILABLE",
    });
  }
  s.tables.push(...tables);
}

// ── Inventory ───────────────────────────────────────────────
const INV: [string, string, number, number][] = [
  ["Chicken", "kg", 4.2, 5], ["Paneer", "kg", 3.2, 4], ["Milk", "L", 8, 10], ["Basmati Rice", "kg", 42, 15],
  ["Coffee Beans", "kg", 6.4, 3], ["Mozzarella", "kg", 9, 5], ["Pizza Dough", "pcs", 38, 20], ["Tomato", "kg", 14, 8],
  ["Onion", "kg", 25, 10], ["Butter", "kg", 3.5, 2], ["Cooking Oil", "L", 18, 10], ["Coke (300 ml)", "pcs", 96, 48],
  ["Sugar", "kg", 20, 8], ["Tea Leaves", "kg", 2.6, 1.5], ["Dark Chocolate", "kg", 0.8, 2], ["Potato", "kg", 30, 12],
];

function seedInventory(s: Store, outletId: string, k: number, rnd: () => number, now: number) {
  const items: InventoryItem[] = INV.map(([name, unit, stock, min], i) => ({
    id: `${outletId}_inv${i}`, outletId, name, unit,
    stock: Math.round(stock * (k === 1 ? 1 : 0.6 + rnd() * 0.9) * 10) / 10, minLevel: min, updatedAt: now - Math.floor(rnd() * 48) * HOUR,
  }));
  s.inventory.push(...items);
  const who = ["Aarti Joshi", "Suresh Nair", "Pawan Deshmukh"];
  const reasons: [StockReason, number][] = [["PURCHASE", 3], ["WASTAGE", -0.4], ["INTERNAL", -0.3], ["CORRECTION", -0.1], ["PURCHASE", 2.5]];
  for (const it of items) {
    let bal = it.stock;
    const n = 4 + Math.floor(rnd() * 3);
    const list: StockMovement[] = [];
    for (let j = 0; j < n; j++) {
      const [reason, f] = reasons[Math.floor(rnd() * reasons.length)]!;
      const mag = Math.max(0.1, Math.round(it.minLevel * Math.abs(f) * (0.5 + rnd()) * 10) / 10);
      const delta = f > 0 ? mag : -mag;
      list.push({
        id: `${it.id}_m${j}`, outletId, inventoryItemId: it.id, itemName: it.name, unit: it.unit, reason, delta, balanceAfter: bal,
        note: reason === "PURCHASE" ? "Vendor delivery" : reason === "WASTAGE" ? "Spoilage" : undefined,
        createdBy: who[Math.floor(rnd() * who.length)]!, createdAt: now - (j * 2 + 1 + rnd()) * DAY * 1.4,
      });
      bal -= delta;
    }
    s.movements.push(...list);
  }
}

// ── Staff ───────────────────────────────────────────────────
function seedEmployees(s: Store) {
  const list: [string, string, Employee["role"], string, number, number, boolean][] = [
    [DEMO.outletKP, "Pawan Deshmukh", "OWNER", "+91 98220 11001", 9 * 60, 18 * 60, false],
    [DEMO.outletKP, "Aarti Joshi", "MANAGER", "+91 98220 11002", 9 * 60, 18 * 60, false],
    [DEMO.outletKP, "Rohan Mehta", "CASHIER", "+91 98220 11003", 11 * 60, 20 * 60, false],
    [DEMO.outletKP, "Sneha Patil", "CASHIER", "+91 98220 11004", 15 * 60, 23 * 60, false],
    [DEMO.outletKP, "Imran Shaikh", "WAITER", "+91 98220 11005", 11 * 60, 20 * 60, false],
    [DEMO.outletKP, "Kavita More", "WAITER", "+91 98220 11006", 16 * 60, 23 * 60, false],
    [DEMO.outletKP, "Suresh Nair", "CHEF", "+91 98220 11007", 10 * 60, 19 * 60, false],
    [DEMO.outletKP, "Deepak Yadav", "CHEF", "+91 98220 11008", 15 * 60, 23 * 60, false],
    [DEMO.outletKP, "Manoj Pawar", "WAITER", "+91 98220 11009", 11 * 60, 20 * 60, true],
    [DEMO.outletBaner, "Nikhil Shah", "MANAGER", "+91 98220 12001", 10 * 60, 19 * 60, false],
    [DEMO.outletBaner, "Vikram Rao", "CASHIER", "+91 98220 12002", 11 * 60, 20 * 60, false],
    [DEMO.outletBaner, "Anita Chavan", "CHEF", "+91 98220 12003", 10 * 60, 19 * 60, false],
  ];
  list.forEach(([outletId, name, role, phone, a, b, off], i) =>
    s.employees.push({ id: `emp_${i}`, outletId, restaurantId: DEMO.restaurant, name, role, phone, shiftStartMin: a, shiftEndMin: b, offToday: off }),
  );
}

// ── Orders ──────────────────────────────────────────────────
const HOUR_W: Record<number, number> = { 8: 2, 9: 4, 10: 5, 11: 6, 12: 11, 13: 14, 14: 10, 15: 6, 16: 7, 17: 9, 18: 11, 19: 14, 20: 15, 21: 11, 22: 5 };
const HOURS = Object.keys(HOUR_W).map(Number);

function buildItems(rnd: () => number, menu: MenuItem[], groups: ModifierGroup[]): OrderItem[] {
  const avail = menu.filter((m) => m.available);
  const n = pickWeighted(rnd, [1, 2, 3, 4, 5], (k) => [0, 0.56, 0.27, 0.12, 0.04, 0.01][k]!);
  const chosen = new Map<string, OrderItem>();
  for (let i = 0; i < n; i++) {
    const m = pickWeighted(rnd, avail, (x) => POPULARITY[x.name] ?? 1);
    const variant = m.variants.length ? (rnd() < 0.72 ? m.variants[0]! : m.variants[1] ?? m.variants[0]!) : undefined;
    const mods: { name: string; price: number }[] = [];
    if (m.modifierGroupIds.length && rnd() < 0.2) {
      const g = groups.find((x) => x.id === m.modifierGroupIds[0]);
      if (g) mods.push({ name: g.modifiers[0]!.name, price: g.modifiers[0]!.price });
    }
    const base = variant?.price ?? m.price;
    const unit = base + mods.reduce((a, x) => a + x.price, 0);
    const key = `${m.id}|${variant?.name}|${mods.map((x) => x.name).join(",")}`;
    const ex = chosen.get(key);
    if (ex) ex.qty += 1;
    else
      chosen.set(key, {
        id: `oi_${Math.floor(rnd() * 1e9).toString(36)}`, menuItemId: m.id, name: m.name, variantName: variant?.name, unitPrice: unit, basePrice: base,
        qty: rnd() < 0.9 ? 1 : rnd() < 0.85 ? 2 : 3, taxRate: m.taxRate, foodType: m.foodType, modifiers: mods,
      });
  }
  return [...chosen.values()];
}

function generateHistory(
  s: Store, outletId: string, cfg: { k: number; days: number }, menu: MenuItem[], groups: ModifierGroup[],
  customers: Customer[], staff: string[], rnd: () => number, now: number, today: number,
) {
  const tables = s.tables.filter((t) => t.outletId === outletId);
  for (let d = 0; d < cfg.days; d++) {
    const dayStart = today - d * DAY;
    const dow = new Date(dayStart + 330 * MIN).getUTCDay();
    const weekend = dow === 0 || dow === 6 || dow === 5;
    const growth = 1 - d * 0.004; // gentle upward trend
    const count = Math.round((weekend ? 150 : 118) * cfg.k * growth * (0.88 + rnd() * 0.24));
    for (let i = 0; i < count; i++) {
      const h = pickWeighted(rnd, HOURS, (x) => HOUR_W[x]!);
      const at = dayStart + h * HOUR + Math.floor(rnd() * 60) * MIN + Math.floor(rnd() * 60_000);
      if (at > now - 40 * MIN) continue; // recent orders are generated as "live" orders
      s.orders.push(makeOrder(s, outletId, at, menu, groups, customers, tables, staff, rnd, "COMPLETED"));
    }
  }
}

export function makeOrder(
  s: Store, outletId: string, at: number, menu: MenuItem[], groups: ModifierGroup[], customers: Customer[],
  tables: RestaurantTable[], staff: string[], rnd: () => number, status: OrderStatus,
  force?: Partial<{ type: OrderType; table: RestaurantTable; items: OrderItem[]; unpaid: boolean; method: PaymentMethod }>,
): Order {
  const type: OrderType = force?.type ?? pickWeighted<OrderType>(rnd, ["DINE_IN", "TAKEAWAY", "DELIVERY"], (t) => (t === "DINE_IN" ? 0.55 : t === "TAKEAWAY" ? 0.3 : 0.15));
  const items = force?.items ?? buildItems(rnd, menu, groups);
  let discount = 0;
  const subtotal = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const hasDiscount = rnd() < 0.08;
  if (hasDiscount) discount = rnd() < 0.5 ? Math.round(subtotal * 0.1) : R(50);
  const totals = computeTotals(items, discount);
  const table = type === "DINE_IN" ? force?.table ?? tables[Math.floor(rnd() * tables.length)] : undefined;
  const cust = rnd() < 0.55 ? customers[Math.floor(Math.pow(rnd(), 2) * customers.length)] : undefined;
  const cashier = staff[Math.floor(rnd() * Math.min(2, staff.length))]!;
  const method: PaymentMethod = force?.method ?? pickWeighted<PaymentMethod>(rnd, ["UPI", "CASH", "CARD"], (m) => (m === "UPI" ? 0.59 : m === "CASH" ? 0.315 : 0.095));
  const prep = (type === "DINE_IN" ? 12 : 9) + Math.floor(rnd() * 8);
  const paid = !force?.unpaid;
  const id = `ord_${outletId}_${at.toString(36)}${Math.floor(rnd() * 1e6).toString(36)}`;
  const events: OrderEvent[] = [
    { at, actor: cashier, action: "Order created", detail: type === "DINE_IN" ? `Dine in · ${table?.name}` : type === "TAKEAWAY" ? "Takeaway" : "Delivery" },
    { at: at + 40_000, actor: "Kitchi", action: "KOT sent to kitchen" },
  ];
  if (status !== "OPEN") events.push({ at: at + 3 * MIN, actor: "Kitchen", action: "Preparing" });
  if (status === "READY" || status === "COMPLETED") events.push({ at: at + prep * MIN, actor: "Kitchen", action: "Marked ready" });
  const payAt = type === "DINE_IN" ? at + (38 + Math.floor(rnd() * 25)) * MIN : at + 40_000;
  const payments = paid && status !== "OPEN" || (paid && status === "OPEN" && type !== "DINE_IN")
    ? [{ id: `pay_${id}`, orderId: id, method, amount: totals.total, reference: method === "UPI" ? `UPI${Math.floor(rnd() * 1e10)}` : undefined, createdAt: payAt }]
    : [];
  if (hasDiscount) events.splice(2, 0, { at: at + 20_000, actor: cashier, action: "Discount applied", detail: `₹${(discount / 100).toFixed(0)} off` });
  if (payments.length) events.push({ at: payAt, actor: cashier, action: "Payment received", detail: `${method} · ₹${(totals.total / 100).toLocaleString("en-IN")}` });
  if (status === "COMPLETED") events.push({ at: Math.max(payAt, at + (prep + 2) * MIN) + 1000, actor: cashier, action: "Order completed" });
  events.sort((a, b) => a.at - b.at);
  return {
    id, outletId, number: 0, type, tableId: table?.id, tableName: table?.name, customerId: cust?.id, customerName: cust?.name,
    status, paymentStatus: payments.length ? "PAID" : "UNPAID", items, ...totals, payments, events, createdBy: cashier,
    createdAt: at, updatedAt: events[events.length - 1]!.at, startedAt: status !== "OPEN" ? at + 3 * MIN : undefined,
    readyAt: status === "READY" || status === "COMPLETED" ? at + prep * MIN : undefined,
  };
}

function generateLive(s: Store, outletId: string, menu: MenuItem[], groups: ModifierGroup[], staff: string[], rnd: () => number, now: number) {
  const tables = s.tables.filter((t) => t.outletId === outletId);
  const customers = s.customers;
  const byName = (n: string) => menu.find((m) => m.name === n)!;
  const line = (n: string, qty: number, variant?: string, mods: [string, number][] = [], note?: string): OrderItem => {
    const m = byName(n);
    const v = m.variants.find((x) => x.name === variant);
    const base = v?.price ?? m.price;
    return { id: `oi_${n}_${Math.floor(rnd() * 1e6)}`, menuItemId: m.id, name: m.name, variantName: v?.name, basePrice: base, unitPrice: base + mods.reduce((a, x) => a + x[1], 0), qty, taxRate: m.taxRate, foodType: m.foodType, modifiers: mods.map(([name, p]) => ({ name, price: R(p) })), note };
  };
  const t = (i: number) => tables[i - 1];
  type Spec = [number, OrderStatus, OrderType, number | undefined, OrderItem[], boolean];
  const specs: Spec[] =
    outletId === DEMO.outletKP
      ? [
          [3, "OPEN", "DINE_IN", 7, [line("Chicken Biryani", 2), line("Paneer Tikka", 1, undefined, [], "No onion"), line("Coke", 2)], true],
          [2, "OPEN", "TAKEAWAY", undefined, [line("Cold Coffee", 2, "Large", [["Extra Shot", 40]]), line("Brownie", 1)], false],
          [7, "PREPARING", "DELIVERY", undefined, [line("Margherita Pizza", 1, "Large", [["Extra Cheese", 40]]), line("French Fries", 1, "Regular")], false],
          [11, "PREPARING", "DINE_IN", 2, [line("Butter Chicken", 1), line("Butter Naan", 3), line("Jeera Rice", 1), line("Fresh Lime Soda", 2)], true],
          [14, "PREPARING", "DINE_IN", 9, [line("Farmhouse Pizza", 1, "Regular"), line("Cappuccino", 2, "Regular"), line("Tiramisu", 1)], true],
          [17, "READY", "TAKEAWAY", undefined, [line("Masala Chai", 3), line("Veg Spring Rolls", 1)], false],
          [26, "READY", "DINE_IN", 4, [line("Chicken Biryani", 2), line("Butter Chicken", 1), line("Butter Naan", 4), line("Paneer Tikka", 1), line("Cold Coffee", 2, "Regular"), line("Brownie", 1, undefined, [["Ice Cream Scoop", 50]])], true],
          [33, "READY", "DINE_IN", 5, [line("Pepperoni Pizza", 1, "Large"), line("French Fries", 1, "Large", [["Cheese Dip", 30]]), line("Iced Tea", 2)], true],
        ]
      : [
          [6, "PREPARING", "DINE_IN", 3, [line("Chicken Biryani", 1), line("Masala Chai", 2)], true],
          [2, "OPEN", "TAKEAWAY", undefined, [line("Cold Coffee", 1, "Regular"), line("Brownie", 1)], false],
        ];
  for (const [age, status, type, tableNo, items, unpaid] of specs) {
    const table = tableNo ? t(tableNo) : undefined;
    const o = makeOrder(s, outletId, now - age * MIN - 17_000, menu, groups, customers, tables, staff, rnd, status, { type, table, items, unpaid, method: "UPI" });
    o.discount = 0; // keep live tickets clean
    Object.assign(o, computeTotals(o.items, 0));
    o.events = o.events.filter((e) => e.action !== "Discount applied");
    o.payments = unpaid ? [] : [{ id: `pay_${o.id}`, orderId: o.id, method: "UPI", amount: o.total, reference: `UPI${Math.floor(rnd() * 1e10)}`, createdAt: o.createdAt + 30_000 }];
    o.paymentStatus = unpaid ? "UNPAID" : "PAID";
    o.events = o.events.filter((e) => e.action !== "Payment received");
    if (!unpaid) o.events.push({ at: o.createdAt + 30_000, actor: o.createdBy, action: "Payment received", detail: `UPI · ₹${(o.total / 100).toLocaleString("en-IN")}` });
    o.events.sort((a, b) => a.at - b.at);
    s.orders.push(o);
    if (table) {
      table.status = status === "READY" && age > 30 ? "BILLING" : "OCCUPIED";
      table.orderId = o.id;
      table.occupiedSince = o.createdAt;
    }
  }
  // A reservation for later this evening
  const rt = tables.find((x) => x.status === "AVAILABLE" && x.seats >= 4);
  if (rt) {
    const start = startOfDayIST(now);
    rt.status = "RESERVED";
    rt.reservedFor = "Mehta · 4 guests";
    rt.reservedAt = Math.max(now + 30 * MIN, start + 20 * HOUR + 30 * MIN);
  }
}

function numberOrders(s: Store, outletId: string) {
  const mine = s.orders.filter((o) => o.outletId === outletId).sort((a, b) => a.createdAt - b.createdAt);
  for (const o of mine) {
    const key = `${outletId}:${dayKey(o.createdAt)}`;
    s.orderCounters[key] = (s.orderCounters[key] ?? 1000) + 1;
    o.number = s.orderCounters[key]!;
  }
}
