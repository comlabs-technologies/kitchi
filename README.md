# Kitchi

The operating system for independent restaurants — billing, orders, tables, kitchen, menu, inventory, customers, staff and reports in one fast workspace.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Radix primitives · React Hook Form + Zod · Zustand (POS cart only) · Recharts · Framer Motion · date-fns.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
npm run db:validate  # validates prisma/schema.prisma
```

Open the app and pick a demo account. Each role sees a different product:

| Account | Role | Lands on |
| --- | --- | --- |
| Pawan Deshmukh | Owner (both outlets) | Overview |
| Aarti Joshi | Manager | Overview |
| Rohan Mehta | Cashier | POS |
| Suresh Nair | Chef | Kitchen |

"Set up your restaurant" on the sign-in page runs the 8-step onboarding and creates a brand-new tenant (own organisation, restaurant, outlet and owner).

Demo data (Kitchi Demo Café, Koregaon Park + Baner, 30 days of orders) is generated deterministically at boot and held **in memory**. It resets when the server restarts.

## Architecture

```
src/
  app/                 routes only: (app) shell group, (fullscreen) KDS, login, onboarding, api/mcp
  components/ui/       design-system primitives (button, dialog, sheet, table, …)
  features/            one folder per product area: pos, orders, tables, kitchen, menu, inventory,
                       customers, staff, reports, settings, overview, onboarding, shell
  lib/                 pure helpers shared by client and server: money (paise), IST time, billing maths, zod schemas
  server/
    auth/              session → TenantContext, RBAC (roles → permissions), signed cookie
    repositories/      the ONLY code that touches storage; every accessor is tenant/outlet-scoped
    services/          domain logic (sales, orders, tables, menu, inventory, reports, …); authorise on entry
    actions/           server actions: validate input → requireAction(permission) → service
    mcp/               MCP tool registry + JSON-RPC transport
    ai/                AIProvider interface, deterministic provider, askKitchi()
    data/              in-memory store + seed
prisma/schema.prisma   PostgreSQL schema mirroring the domain model
```

### Multi-tenancy

`Organization → Restaurant → Outlet`. The session cookie holds only a signed user id. `getContext()` resolves the user's `Membership` into a `TenantContext` (organisation, restaurant, allowed outlets, active outlet, role) on the server. Every service takes that context and every repository query is filtered by it. No tenant id is ever read from request input; the outlet cookie is only a preference and is honoured only if the membership grants that outlet.

### RBAC

`server/auth/rbac.ts` maps roles (Owner, Manager, Cashier, Waiter, Chef) to permissions. It is enforced in three places: pages (`requirePage`), server actions (`requireAction`) and again inside services (`assertCan`). The sidebar and buttons only mirror it. The matrix is visible in Settings → Users & roles.

### POS, offline and printing

- POS state is a Zustand store (persisted, so a refresh doesn't lose the cart). It never calls the network directly.
- `features/pos/gateway.ts` is the order gateway: online → server action; offline or transport failure → local queue → `flushQueue()` replays when the connection returns. Orders carry a client `clientRef` and the server is idempotent on it, so retries can't duplicate.
- The server re-prices every line from the catalogue and re-validates payment totals. The client's prices are never trusted.
- `features/pos/print-service.ts` defines `PrintService { printReceipt, printKOT }` with a browser implementation (hidden iframe → `window.print`). ESC/POS drivers can implement the same interface.

### MCP and Ask Kitchi

`POST /api/mcp` speaks JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`). It is not linked from the UI. Authenticate with `Authorization: Bearer $KITCHI_MCP_TOKEN` (dev default `kitchi-dev-token`).

```
MCP tool → permission check → domain service (re-checks) → repository (tenant-scoped)
```

14 tools: `restaurant.get_daily_sales|get_sales_summary|get_orders|get_order|get_top_items|get_payment_breakdown`, `menu.get_items|get_item|update_availability`, `inventory.get_stock|get_low_stock|get_stock_movements`, `staff.get_today_attendance`, `reports.get_daily_summary`. The convenience wrappers `getDailySales`, `getOrders`, `getTopSellingItems`, `getLowStockItems` and `getDailySummaryTool` are exported from `server/mcp/tools.ts`.

Ask Kitchi (⌘/Ctrl + J) goes through `AIProvider` (`server/ai/provider.ts`). The MVP ships a deterministic provider that maps intents to the same MCP tools; an Anthropic/OpenAI provider would run its tool-use loop against `tools` and `callTool`, which enforces the caller's RBAC.

### Going to production

1. **Auth** — swap `readSessionUserId()` in `server/auth/session.ts` for Auth.js/Clerk/WorkOS. Set `SESSION_SECRET` until then.
2. **Database** — implement `repos(ctx)` (same signatures) with Prisma against `prisma/schema.prisma`. Services, actions, MCP and UI don't change.
3. **Realtime** — KDS and Orders poll with `router.refresh()` every 8 s today; swap for SSE/WebSocket.
4. **Integrations marked "Coming soon"** — dynamic UPI QR, card terminals, WhatsApp Business API (currently mocked), thermal printers, photo upload, custom modifier groups, user invites, billing.

## Keyboard

`⌘/Ctrl K` command palette · `⌘/Ctrl J` Ask Kitchi · POS: `/` search, `Ctrl+Enter` charge, `Alt+K` KOT, `Alt+H` hold, `Alt+D` discount, `Alt+C` customer, `Alt+N` note, `Alt+1/2/3` order type · Payment: `1–4` choose method.
