"use server";
import { customerSchema, employeeSchema, menuItemSchema, newInventoryItemSchema, stockAdjustSchema } from "@/lib/schemas";
import { requireAction } from "@/server/auth/session";
import { addInventoryItem, adjustStock } from "@/server/services/inventory";
import { addCategory, createMenuItem, deleteMenuItem, duplicateMenuItem, setAvailability, updateMenuItem } from "@/server/services/menu";
import { addEmployee } from "@/server/services/staff";
import { addTable, assignTable, closeTable, mergeTables, releaseReservation, reserveTable, transferTable } from "@/server/services/tables";
import { createCustomer } from "@/server/services/customers";
import { getDailySummary } from "@/server/services/overview";
import { updateOutlet, updateRestaurant, updateSettings } from "@/server/services/tenant";
import { askKitchi } from "@/server/ai";
import { z } from "zod";
import { safe } from "./safe";

// Tables
export async function assignTableAction(tableId: string, orderId: string) { return safe(async () => assignTable(await requireAction("tables.manage"), tableId, orderId)); }
export async function transferTableAction(from: string, to: string) { return safe(async () => transferTable(await requireAction("tables.manage"), from, to)); }
export async function mergeTablesAction(primary: string, others: string[]) { return safe(async () => mergeTables(await requireAction("tables.manage"), primary, others)); }
export async function closeTableAction(id: string) { return safe(async () => closeTable(await requireAction("tables.manage"), id)); }
export async function reserveTableAction(id: string, guest: string, at: number) {
  return safe(async () => reserveTable(await requireAction("tables.manage"), id, z.string().trim().min(2, "Enter the guest name").parse(guest), at));
}
export async function releaseReservationAction(id: string) { return safe(async () => releaseReservation(await requireAction("tables.manage"), id)); }
export async function addTableAction(name: string, seats: number, section: string) {
  return safe(async () => addTable(await requireAction("tables.manage"), z.string().trim().min(1, "Name is required").parse(name), seats, section));
}

// Menu
export async function saveMenuItemAction(id: string | null, raw: unknown) {
  return safe(async () => {
    const ctx = await requireAction("menu.manage");
    const input = menuItemSchema.parse(raw);
    const m = id ? updateMenuItem(ctx, id, input) : createMenuItem(ctx, input);
    return { id: m.id };
  });
}
export async function duplicateMenuItemAction(id: string) { return safe(async () => ({ id: duplicateMenuItem(await requireAction("menu.manage"), id).id })); }
export async function setAvailabilityAction(id: string, available: boolean) { return safe(async () => void setAvailability(await requireAction("menu.manage"), id, available)); }
export async function deleteMenuItemAction(id: string) { return safe(async () => deleteMenuItem(await requireAction("menu.manage"), id)); }
export async function addCategoryAction(name: string) { return safe(async () => addCategory(await requireAction("menu.manage"), name)); }

// Inventory
export async function adjustStockAction(raw: unknown) { return safe(async () => void adjustStock(await requireAction("inventory.manage"), stockAdjustSchema.parse(raw))); }
export async function addInventoryItemAction(raw: unknown) { return safe(async () => void addInventoryItem(await requireAction("inventory.manage"), newInventoryItemSchema.parse(raw))); }

// Customers & staff
export async function addCustomerAction(raw: unknown) { return safe(async () => void createCustomer(await requireAction("customers.manage"), customerSchema.parse(raw))); }
export async function addEmployeeAction(raw: unknown) { return safe(async () => addEmployee(await requireAction("staff.manage"), employeeSchema.parse(raw))); }

// Settings
export async function updateRestaurantAction(raw: { name?: string; legalName?: string; gstEnabled?: boolean; gstin?: string; defaultTaxRate?: number }) {
  return safe(async () => updateRestaurant(await requireAction("settings.manage"), raw));
}
export async function updateOutletAction(raw: { name?: string; city?: string; address?: string; phone?: string; fssai?: string }) {
  return safe(async () => updateOutlet(await requireAction("settings.manage"), raw));
}
export async function updateSettingsAction(raw: Parameters<typeof updateSettings>[1]) {
  return safe(async () => updateSettings(await requireAction("settings.manage"), raw));
}

// Daily summary (WhatsApp delivery is mocked)
export async function sendDailySummaryAction(phone: string) {
  return safe(async () => {
    const ctx = await requireAction("reports.view");
    const s = getDailySummary(ctx);
    // Integration point: WhatsApp Business API template message.
    return { to: phone, preview: s.whatsappText };
  }, { revalidate: false });
}

// Ask Kitchi
export async function askKitchiAction(question: string) {
  const ctx = await requireAction("ai.use");
  return askKitchi(ctx, question);
}
