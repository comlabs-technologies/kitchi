"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, ChevronsUpDown, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Store, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Tooltip } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/primitives";
import { Wordmark, LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { useIsMac, useMediaQuery, useOnline } from "@/lib/hooks";
import { useUI } from "@/lib/ui-store";
import { cn, initials } from "@/lib/utils";
import { signOut, switchOutlet } from "@/server/actions/auth";
import { ROLE_LABEL, can } from "@/server/auth/rbac";
import type { Role } from "@/types/domain";
import { flushQueue, useQueuedCount } from "@/features/pos/gateway";
import { AskKitchi } from "./ask-kitchi";
import { CommandPalette } from "./command-palette";
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from "./nav";

export interface ShellProps {
  user: { name: string; role: Role };
  restaurantName: string;
  outlets: { id: string; name: string; city: string }[];
  activeOutletId: string;
  notifications: { id: string; title: string; detail: string; href: string; tone: "warn" | "danger" | "neutral" }[];
  children: React.ReactNode;
}

export function AppShell({ user, restaurantName, outlets, activeOutletId, notifications, children }: ShellProps) {
  const userCollapsed = useUI((s) => s.sidebarCollapsed);
  const narrow = useMediaQuery("(max-width: 1279px)");
  const mobileOpen = useUI((s) => s.mobileNavOpen);
  const setMobile = useUI((s) => s.setMobileNav);
  const pathname = usePathname();
  // POS wants every pixel on tablets: the rail collapses automatically below 1280px.
  const collapsed = userCollapsed || (narrow && pathname.startsWith("/pos"));
  const online = useOnline();
  const queued = useQueuedCount();
  const router = useRouter();

  React.useEffect(() => void useUI.persist.rehydrate(), []);
  React.useEffect(() => setMobile(false), [pathname, setMobile]);

  // Sync service: replay queued orders whenever we're back online.
  React.useEffect(() => {
    if (!online) return;
    void flushQueue().then(({ synced }) => {
      if (synced > 0) {
        toast.success(`${synced} offline order${synced > 1 ? "s" : ""} synced`);
        router.refresh();
      }
    });
  }, [online, queued, router]);

  const visible = (items: NavItem[]) => items.filter((i) => !i.permission || can(user.role, i.permission));

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className={cn("no-print hidden shrink-0 flex-col border-r border-line bg-background transition-[width] duration-200 md:flex", collapsed ? "w-[60px]" : "w-[224px]")} aria-label="Primary">
        <SidebarContent collapsed={collapsed} visible={visible} pathname={pathname} />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobile}>
        <DialogContent title="Navigation" hideClose className="left-0 top-0 h-dvh max-h-none w-[260px] max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0 [&>div:first-child]:sr-only">
          <SidebarContent collapsed={false} visible={visible} pathname={pathname} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} restaurantName={restaurantName} outlets={outlets} activeOutletId={activeOutletId} notifications={notifications} />
        {(!online || queued > 0) && (
          <div role="status" className="no-print flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-1.5 text-[13px] text-warn">
            <WifiOff className="size-3.5 shrink-0" />
            {!online ? <span><b className="font-medium">You&apos;re offline.</b> Kitchi will continue recording orders and sync them once connection returns.</span> : <span>Syncing {queued} offline order{queued > 1 ? "s" : ""}…</span>}
            {queued > 0 && !online && <Badge tone="warn" className="ml-auto">{queued} queued</Badge>}
          </div>
        )}
        <main id="main" className="relative min-h-0 flex-1 overflow-y-auto scroll-thin">{children}</main>
      </div>

      <CommandPalette role={user.role} outlets={outlets} activeOutletId={activeOutletId} />
      <AskKitchi canAsk={can(user.role, "ai.use")} />
    </div>
  );
}

function SidebarContent({ collapsed, visible, pathname }: { collapsed: boolean; visible: (i: NavItem[]) => NavItem[]; pathname: string }) {
  const toggle = useUI((s) => s.toggleSidebar);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <>
      <div className={cn("flex h-[52px] shrink-0 items-center px-3.5", collapsed && "justify-center px-0")}>
        <Link href="/overview" aria-label="Kitchi home" className="rounded-md">
          {collapsed ? <LogoMark /> : <Wordmark />}
        </Link>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-1" aria-label="Main">
        <ul className="space-y-0.5">
          {visible(MAIN_NAV).map((item) => (
            <li key={item.href}><NavLink item={item} active={isActive(item.href)} collapsed={collapsed} /></li>
          ))}
        </ul>
      </nav>
      <div className="space-y-0.5 border-t border-line px-2 py-2">
        {visible(SECONDARY_NAV).map((item) => <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />)}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("hidden w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-fg-subtle transition-colors hover:bg-muted hover:text-fg md:flex", collapsed && "justify-center px-0")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
        </button>
      </div>
    </>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active ? "bg-muted-2/70 text-fg" : "text-fg-muted hover:bg-muted hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );
  return collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link;
}

function Topbar({ user, restaurantName, outlets, activeOutletId, notifications }: Omit<ShellProps, "children">) {
  const setMobile = useUI((s) => s.setMobileNav);
  const setPalette = useUI((s) => s.setPalette);
  const openAsk = useUI((s) => s.openAsk);
  const mac = useIsMac();
  const router = useRouter();
  const active = outlets.find((o) => o.id === activeOutletId) ?? outlets[0]!;

  return (
    <header className="no-print flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-background px-3 sm:px-4">
      <button type="button" className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-muted md:hidden" onClick={() => setMobile(true)} aria-label="Open navigation">
        <MenuIcon className="size-4.5" />
      </button>

      <Dropdown>
        <DropdownTrigger className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-muted data-[state=open]:bg-muted" aria-label="Switch outlet">
          <Store className="size-4 shrink-0 text-fg-subtle" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-medium">{active.name}</span>
            <span className="hidden truncate text-[11px] text-fg-subtle sm:block">{restaurantName}</span>
          </span>
          {outlets.length > 1 && <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" />}
        </DropdownTrigger>
        <DropdownContent align="start" className="min-w-[240px]">
          <DropdownLabel>{restaurantName}</DropdownLabel>
          {outlets.map((o) => (
            <DropdownItem
              key={o.id}
              icon={o.id === active.id ? <Check /> : undefined}
              onSelect={async () => {
                if (o.id === active.id) return;
                const r = await switchOutlet(o.id);
                if (r.ok) {
                  toast.success(`Switched to ${o.name}`);
                  router.refresh();
                } else toast.error(r.error);
              }}
            >
              <span className="block">{o.name}</span>
              <span className="block text-[11px] text-fg-subtle">{o.city}</span>
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem disabled>Add outlet · Coming soon</DropdownItem>
        </DropdownContent>
      </Dropdown>

      <div className="mx-auto hidden w-full max-w-[420px] flex-1 sm:block">
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-fg-subtle transition-colors hover:border-[#c3c0b6]"
          aria-label="Search or run a command"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search or run a command…</span>
          <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd><Kbd>K</Kbd>
        </button>
      </div>
      <div className="flex-1 sm:hidden" />

      <Tooltip label="Search" side="bottom">
        <button type="button" className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-muted sm:hidden" onClick={() => setPalette(true)} aria-label="Search">
          <Search className="size-4" />
        </button>
      </Tooltip>
      {can(user.role, "ai.use") && (
        <button type="button" onClick={() => openAsk()} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-muted hover:text-fg" aria-label="Ask Kitchi">
          <Sparkles className="size-3.5 text-brand" />
          <span className="hidden lg:inline">Ask Kitchi</span>
        </button>
      )}

      <Dropdown>
        <DropdownTrigger className="relative grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-muted data-[state=open]:bg-muted" aria-label={`Notifications${notifications.length ? `, ${notifications.length} new` : ""}`}>
          <Bell className="size-4" />
          {notifications.length > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-danger" />}
        </DropdownTrigger>
        <DropdownContent className="w-[320px]">
          <DropdownLabel>Notifications</DropdownLabel>
          {notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-fg-muted">You&apos;re all caught up.</p>
          ) : (
            notifications.map((n) => (
              <DropdownItem key={n.id} onSelect={() => router.push(n.href)} className="items-start">
                <span className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.tone === "danger" ? "bg-danger" : n.tone === "warn" ? "bg-warn" : "bg-fg-subtle")} />
                  <span><span className="block text-[13px] font-medium">{n.title}</span><span className="block text-xs text-fg-muted">{n.detail}</span></span>
                </span>
              </DropdownItem>
            ))
          )}
        </DropdownContent>
      </Dropdown>

      <Dropdown>
        <DropdownTrigger className="grid size-8 place-items-center rounded-full bg-muted-2 text-[11px] font-semibold text-fg-muted transition-colors hover:bg-[#e2dfd7] data-[state=open]:bg-[#e2dfd7]" aria-label="Account menu">
          {initials(user.name)}
        </DropdownTrigger>
        <DropdownContent className="w-[220px]">
          <div className="px-2 py-1.5">
            <p className="text-[13px] font-medium">{user.name}</p>
            <p className="text-xs text-fg-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <DropdownSeparator />
          <DropdownItem onSelect={() => router.push("/settings")} disabled={!can(user.role, "settings.view")}>Settings</DropdownItem>
          <DropdownItem onSelect={() => router.push("/help")}>Help &amp; shortcuts</DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<LogOut />} onSelect={() => void signOut()}>Sign out</DropdownItem>
        </DropdownContent>
      </Dropdown>
    </header>
  );
}
