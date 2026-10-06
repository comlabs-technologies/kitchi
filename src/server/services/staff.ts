import { istMinutes } from "@/lib/time";
import { uid } from "@/lib/utils";
import { assertCan, type TenantContext } from "@/server/auth/context";
import { repos } from "@/server/repositories";
import type { Employee } from "@/types/domain";

export type ShiftStatus = "ON_SHIFT" | "UPCOMING" | "DONE" | "OFF";
export interface StaffRow extends Employee {
  outletName: string;
  shiftStatus: ShiftStatus;
}

export function listStaff(ctx: TenantContext, now = Date.now()): StaffRow[] {
  assertCan(ctx, "staff.view");
  const r = repos(ctx);
  const outlets = new Map(r.outlets().map((o) => [o.id, o.name]));
  const m = istMinutes(now);
  return r.employees().map((e) => ({
    ...e,
    outletName: outlets.get(e.outletId) ?? "",
    shiftStatus: e.offToday ? "OFF" : m < e.shiftStartMin ? "UPCOMING" : m >= e.shiftEndMin ? "DONE" : "ON_SHIFT",
  }));
}

export function getTodayAttendance(ctx: TenantContext, now = Date.now()) {
  return listStaff(ctx, now).filter((e) => e.outletId === ctx.outletId);
}

export function addEmployee(ctx: TenantContext, input: { name: string; phone: string; role: Employee["role"]; shiftStart: string; shiftEnd: string }) {
  assertCan(ctx, "staff.manage");
  const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  repos(ctx).addEmployee({
    id: uid("emp"), outletId: ctx.outletId, restaurantId: ctx.restaurantId, name: input.name, role: input.role, phone: input.phone,
    shiftStartMin: mins(input.shiftStart), shiftEndMin: mins(input.shiftEnd), offToday: false,
  });
}
