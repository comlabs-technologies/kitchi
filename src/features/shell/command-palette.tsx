"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { Armchair, ChartColumn, ChefHat, ClipboardList, CreditCard, Package, Plus, Search, Sparkles, Store, TriangleAlert, UtensilsCrossed, Users, IdCard, Settings, LayoutDashboard, Send, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useUI } from "@/lib/ui-store";
import { can } from "@/server/auth/rbac";
import type { Permission } from "@/server/auth/rbac";
import type { Role } from "@/types/domain";
import { switchOutlet } from "@/server/actions/auth";

interface Cmd {
  id: string;
  label: string;
  group: "Actions" | "Go to" | "Outlets";
  icon: React.ReactNode;
  permission?: Permission;
  keywords?: string;
  run: () => void | Promise<void>;
  hint?: string;
}

export function CommandPalette({ role, outlets, activeOutletId }: { role: Role; outlets: { id: string; name: string }[]; activeOutletId: string }) {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPalette);
  const openAsk = useUI((s) => s.openAsk);
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUI.getState().paletteOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        useUI.getState().openAsk();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => () => router.push(href);
  const commands = ([
    { id: "new-order", label: "New order", group: "Actions", icon: <Plus />, permission: "pos.use", keywords: "bill create sale", run: go("/pos"), hint: "N" },
    { id: "add-item", label: "Add menu item", group: "Actions", icon: <UtensilsCrossed />, permission: "menu.manage", run: go("/menu?new=1") },
    { id: "sales", label: "View today's sales", group: "Actions", icon: <TrendingUp />, permission: "reports.view", keywords: "revenue report", run: go("/reports?range=today") },
    { id: "low", label: "View low stock", group: "Actions", icon: <TriangleAlert />, permission: "inventory.view", keywords: "inventory running low", run: go("/inventory?status=low") },
    { id: "summary", label: "Daily summary", group: "Actions", icon: <Send />, permission: "reports.view", keywords: "whatsapp digest", run: go("/reports?tab=summary") },
    { id: "ask", label: "Ask Kitchi…", group: "Actions", icon: <Sparkles />, permission: "ai.use", keywords: "assistant ai question", run: () => openAsk(), hint: "⌘J" },
    { id: "g-overview", label: "Overview", group: "Go to", icon: <LayoutDashboard />, permission: "overview.view", run: go("/overview") },
    { id: "g-pos", label: "Open POS", group: "Go to", icon: <CreditCard />, permission: "pos.use", run: go("/pos") },
    { id: "g-orders", label: "Orders", group: "Go to", icon: <ClipboardList />, permission: "orders.view", run: go("/orders") },
    { id: "g-tables", label: "Tables", group: "Go to", icon: <Armchair />, permission: "tables.view", run: go("/tables") },
    { id: "g-kitchen", label: "Open Kitchen", group: "Go to", icon: <ChefHat />, permission: "kitchen.view", keywords: "kds", run: go("/kitchen") },
    { id: "g-menu", label: "Menu", group: "Go to", icon: <UtensilsCrossed />, permission: "menu.view", run: go("/menu") },
    { id: "g-inv", label: "Open Inventory", group: "Go to", icon: <Package />, permission: "inventory.view", run: go("/inventory") },
    { id: "g-cust", label: "Customers", group: "Go to", icon: <Users />, permission: "customers.view", run: go("/customers") },
    { id: "g-staff", label: "Staff", group: "Go to", icon: <IdCard />, permission: "staff.view", run: go("/staff") },
    { id: "g-reports", label: "Reports", group: "Go to", icon: <ChartColumn />, permission: "reports.view", run: go("/reports") },
    { id: "g-settings", label: "Settings", group: "Go to", icon: <Settings />, permission: "settings.view", run: go("/settings") },
    ...outlets.filter((o) => o.id !== activeOutletId).map<Cmd>((o) => ({
      id: `outlet-${o.id}`, label: `Switch outlet: ${o.name}`, group: "Outlets", icon: <Store />, keywords: "location",
      run: async () => {
        const r = await switchOutlet(o.id);
        if (r.ok) { toast.success(`Switched to ${o.name}`); router.refresh(); } else toast.error(r.error);
      },
    })),
  ] as Cmd[]).filter((c) => !c.permission || can(role, c.permission));

  const groups = ["Actions", "Go to", "Outlets"] as const;
  const looksLikeQuestion = query.trim().length > 3 && can(role, "ai.use");

  const run = (fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-[rgba(20,20,18,0.32)]" />
        <D.Content className="anim-pop fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop focus:outline-none" aria-label="Command palette">
          <D.Title className="sr-only">Command palette</D.Title>
          <D.Description className="sr-only">Search pages and actions</D.Description>
          <Command loop label="Command palette">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 text-fg-subtle" />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Type a command or ask a question…" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-subtle" />
              <kbd className="rounded border border-line-strong px-1.5 text-[10.5px] text-fg-subtle">Esc</kbd>
            </div>
            <Command.List className="scroll-thin max-h-[min(380px,60vh)] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-fg-muted">No matching commands.</Command.Empty>
              {groups.map((g) => {
                const items = commands.filter((c) => c.group === g);
                if (!items.length) return null;
                return (
                  <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-fg-subtle">
                    {items.map((c) => (
                      <Command.Item key={c.id} value={`${c.label} ${c.keywords ?? ""}`} onSelect={() => run(c.run)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-fg aria-selected:bg-muted [&_svg]:size-4 [&_svg]:text-fg-subtle">
                        {c.icon}
                        <span className="flex-1">{c.label}</span>
                        {c.hint && <span className="text-[11px] text-fg-subtle">{c.hint}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
              {looksLikeQuestion && (
                <Command.Group heading="Ask" forceMount>
                  <Command.Item forceMount value={`ask-${query}`} onSelect={() => { setOpen(false); openAsk(query); }} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] aria-selected:bg-muted [&_svg]:size-4 [&_svg]:text-brand">
                    <Sparkles />
                    <span className="flex-1 truncate">Ask Kitchi: “{query}”</span>
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
