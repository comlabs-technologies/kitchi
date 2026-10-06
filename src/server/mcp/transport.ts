import { store } from "@/server/data/store";
import { DEMO } from "@/server/data/seed";
import type { TenantContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/auth/rbac";
import { callTool, listTools, McpError } from "./tools";

/**
 * Minimal MCP (JSON-RPC 2.0, Streamable-HTTP style single-response) transport.
 * Not exposed in the product UI. Authenticated by a bearer token mapped to a user, so the tenant is
 * always derived server-side. Replace with per-organisation API keys / OAuth before enabling for customers.
 */
export function resolveMcpContext(authHeader: string | null): TenantContext | null {
  const expected = process.env.KITCHI_MCP_TOKEN ?? (process.env.NODE_ENV === "production" ? undefined : "kitchi-dev-token");
  if (!expected || authHeader !== `Bearer ${expected}`) return null;
  const userId = DEMO.owner;
  const user = store.users.find((u) => u.id === userId);
  const m = store.memberships.find((x) => x.userId === userId);
  if (!user || !m) return null;
  return { userId, userName: `${user.name} (MCP)`, organizationId: m.organizationId, restaurantId: m.restaurantId, outletId: m.outletIds[0]!, outletIds: m.outletIds, role: m.role };
}

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: { name?: string; arguments?: unknown };
}

export async function handleRpc(ctx: TenantContext, req: RpcRequest) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0" as const, id: req.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0" as const, id: req.id ?? null, error: { code, message } });
  try {
    switch (req.method) {
      case "initialize":
        return ok({ protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "kitchi", version: "0.1.0" } });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: listTools() });
      case "tools/call": {
        try {
          const out = await callTool(ctx, req.params?.name ?? "", req.params?.arguments);
          return ok({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: false });
        } catch (e) {
          if (e instanceof ForbiddenError) return ok({ content: [{ type: "text", text: `Forbidden: ${e.message}` }], isError: true });
          throw e;
        }
      }
      default:
        return err(-32601, `Method not found: ${req.method}`);
    }
  } catch (e) {
    if (e instanceof McpError) return err(e.code, e.message);
    return err(-32603, e instanceof Error ? e.message : "Internal error");
  }
}
