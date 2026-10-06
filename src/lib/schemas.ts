import { z } from "zod";

export const foodTypeSchema = z.enum(["VEG", "NON_VEG", "EGG"]);
export const orderTypeSchema = z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]);
export const paymentMethodSchema = z.enum(["UPI", "CASH", "CARD"]);
export const stockReasonSchema = z.enum(["PURCHASE", "WASTAGE", "CORRECTION", "INTERNAL"]);

export const submitOrderSchema = z.object({
  clientRef: z.string().min(6).max(64),
  orderId: z.string().optional(),
  type: orderTypeSchema,
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  note: z.string().max(300).optional(),
  discount: z.object({ kind: z.enum(["PERCENT", "FLAT"]), value: z.number().min(0) }).nullable().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        variantId: z.string().optional(),
        modifierIds: z.array(z.string()).default([]),
        qty: z.number().int().min(1).max(99),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1, "Add at least one item"),
  /** Present when the cashier charged the order. Amounts are paise and must sum to the server-computed total. */
  payment: z
    .object({ lines: z.array(z.object({ method: paymentMethodSchema, amount: z.number().int().min(1), tendered: z.number().int().optional() })).min(1) })
    .optional(),
});
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: z.string().max(240).default(""),
  categoryId: z.string().min(1, "Choose a category"),
  price: z.coerce.number().min(0, "Enter a price").max(100000),
  taxRate: z.coerce.number().min(0).max(28),
  foodType: foodTypeSchema,
  sku: z.string().max(24).default(""),
  available: z.boolean().default(true),
  variants: z.array(z.object({ name: z.string().trim().min(1, "Name"), price: z.coerce.number().min(0) })).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
});
export type MenuItemFormInput = z.input<typeof menuItemSchema>;
export type MenuItemInput = z.output<typeof menuItemSchema>;

export const stockAdjustSchema = z.object({
  itemId: z.string().min(1, "Choose an item"),
  quantity: z.coerce.number().min(0, "Enter a quantity"),
  reason: stockReasonSchema,
  note: z.string().max(200).optional(),
});
export type StockAdjustInput = z.output<typeof stockAdjustSchema>;

export const newInventoryItemSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  unit: z.string().trim().min(1, "Unit"),
  stock: z.coerce.number().min(0),
  minLevel: z.coerce.number().min(0),
});

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().min(8, "Phone is required"),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "WAITER", "CHEF"]),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().min(8, "Enter a valid phone number"),
});

export const onboardingSchema = z.object({
  ownerName: z.string().trim().min(2, "Your name"),
  email: z.string().email("Enter a valid email"),
  restaurantName: z.string().trim().min(2, "Restaurant name is required"),
  type: z.enum(["CAFE", "RESTAURANT", "QSR", "CLOUD_KITCHEN", "BAKERY", "BAR", "OTHER"]),
  outletName: z.string().trim().min(2, "Outlet name is required"),
  city: z.string().trim().min(2, "City"),
  address: z.string().trim().min(4, "Address"),
  phone: z.string().trim().min(8, "Phone"),
  legalName: z.string().trim().optional(),
  gstEnabled: z.boolean(),
  gstin: z.string().trim().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(28),
  menuMode: z.enum(["STARTER", "EMPTY"]),
  tableCount: z.coerce.number().int().min(0).max(80),
});
export type OnboardingInput = z.output<typeof onboardingSchema>;
export type OnboardingFormInput = z.input<typeof onboardingSchema>;
