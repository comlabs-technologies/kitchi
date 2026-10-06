import "server-only";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action";
import { ForbiddenError } from "@/server/auth/rbac";
import { DomainError } from "@/server/services/orders";
import { ZodError } from "zod";

/** Runs a server action body and converts expected failures into a typed result. Unexpected errors are logged and masked. */
export async function safe<T>(fn: () => Promise<T> | T, opts: { revalidate?: boolean } = { revalidate: true }): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that." };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
