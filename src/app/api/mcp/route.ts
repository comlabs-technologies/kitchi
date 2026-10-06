import { NextResponse } from "next/server";
import { handleRpc, resolveMcpContext } from "@/server/mcp/transport";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = resolveMcpContext(req.headers.get("authorization"));
  if (!ctx) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msg = body as { id?: unknown; method?: string };
  if (typeof msg.method !== "string") return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  if (msg.method.startsWith("notifications/")) return new NextResponse(null, { status: 202 });
  return NextResponse.json(await handleRpc(ctx, body as never));
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
