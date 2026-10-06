/**
 * Kitchi domain model. Mirrors prisma/schema.prisma.
 * - Money is integer paise.
 * - Timestamps are epoch milliseconds (serialisable across the server/client boundary).
 * - Every tenant-owned record carries its ownership keys; services never accept them from the client.
 */

export type RestaurantType = "CAFE" | "RESTAURANT" | "QSR" | "CLOUD_KITCHEN" | "BAKERY" | "BAR" | "OTHER";
export type Role = "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "CHEF";
export type FoodType = "VEG" | "NON_VEG" | "EGG";
export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus = "OPEN" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PAID";
export type PaymentMethod = "UPI" | "CASH" | "CARD";
export type TableStatus = "AVAILABLE" | "OCCUPIED" | "BILLING" | "RESERVED";
export type StockReason = "PURCHASE" | "WASTAGE" | "CORRECTION" | "INTERNAL" | "SALE";
export type StockStatus = "HEALTHY" | "LOW" | "CRITICAL";

export interface Organization {
  id: string;
  name: string;
  plan: "TRIAL" | "STARTER" | "GROWTH";
  createdAt: number;
}

export interface SetupState {
  menu: boolean;
  tables: boolean;
  tax: boolean;
  firstOrder: boolean;
}

export interface Restaurant {
  id: string;
  organizationId: string;
  name: string;
  type: RestaurantType;
  legalName?: string;
  gstEnabled: boolean;
  gstin?: string;
  defaultTaxRate: number; // percent
  pricesIncludeTax: boolean;
  setup: SetupState;
  createdAt: number;
}

export interface Outlet {
  id: string;
  organizationId: string;
  restaurantId: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  fssai?: string;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  restaurantId: string;
  outletIds: string[];
  role: Role;
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  restaurantId: string;
  name: string;
  maxSelect: number;
  modifiers: Modifier[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  taxRate: number; // percent
  foodType: FoodType;
  sku: string;
  imageUrl?: string;
  available: boolean;
  popular: boolean;
  variants: MenuVariant[];
  modifierGroupIds: string[];
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RestaurantTable {
  id: string;
  outletId: string;
  name: string;
  seats: number;
  section: string;
  status: TableStatus;
  orderId?: string;
  reservedFor?: string;
  reservedAt?: number;
  occupiedSince?: number;
}

export interface OrderItemModifier {
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  variantName?: string;
  unitPrice: number; // variant price + modifiers
  basePrice: number;
  qty: number;
  taxRate: number;
  foodType: FoodType;
  modifiers: OrderItemModifier[];
  note?: string;
}

export interface OrderEvent {
  at: number;
  actor: string;
  action: string;
  detail?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  createdAt: number;
}

export interface Order {
  id: string;
  outletId: string;
  number: number;
  type: OrderType;
  tableId?: string;
  tableName?: string;
  customerId?: string;
  customerName?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  roundOff: number;
  total: number;
  note?: string;
  payments: Payment[];
  events: OrderEvent[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  readyAt?: number;
  startedAt?: number;
  servedAt?: number;
  /** Client-generated idempotency key so offline retries never duplicate an order. */
  clientRef?: string;
}

export interface Customer {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: number;
}

export interface InventoryItem {
  id: string;
  outletId: string;
  name: string;
  unit: string;
  stock: number;
  minLevel: number;
  updatedAt: number;
}

export interface StockMovement {
  id: string;
  outletId: string;
  inventoryItemId: string;
  itemName: string;
  unit: string;
  reason: StockReason;
  delta: number;
  balanceAfter: number;
  note?: string;
  createdBy: string;
  createdAt: number;
}

export interface Employee {
  id: string;
  outletId: string;
  restaurantId: string;
  name: string;
  role: Role;
  phone: string;
  shiftStartMin: number; // minutes from midnight IST
  shiftEndMin: number;
  offToday: boolean;
}

export interface OutletSettings {
  outletId: string;
  acceptUpi: boolean;
  acceptCash: boolean;
  acceptCard: boolean;
  upiId: string;
  receiptFooter: string;
  autoPrintKot: boolean;
  kotPrinter: string;
  receiptPrinter: string;
}
