"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  Home, Inbox, Folder, Layers, GitBranch, Map, Kanban, List, Timer, Search, Gauge, BarChart3, Users, Wallet, Shield, Mail, Terminal, Settings,
  Bell, Plus, PanelLeftClose, PanelLeft, HelpCircle, LogOut, ChevronDown, Languages,
} from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "@/components/ui/bits";
import { apiFetch } from "@/lib/client";
import { CreateIssueModal } from "@/components/issues/create-issue";

const ICONS = { home: Home, inbox: Inbox, folder: Folder, layers: Layers, "git-branch": GitBranch, map: Map, kanban: Kanban, list: List, timer: Timer, search: Search, gauge: Gauge, "bar-chart": BarChart3, users: Users, wallet: Wallet, shield: Shield, mail: Mail, terminal: Terminal, settings: Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; section?: string };

export function Shell({ nav, user, workspace, workspaces, unread, canCreate, children }: {
  nav: NavItem[]; user: { name: string; email: string; role: string }; workspace: { id: string; name: string }; workspaces: { id: string; name: string }[]; unread: number; canCreate: boolean; children: ReactNode;
}) {
  const path = usePathname(); const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<null | "user" | "ws">(null);
  const [q, setQ] = useState("");
  const [create, setCreate] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("epm_nav") === "1"); } catch {} }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (e.key === "c" && canCreate) { e.preventDefault(); setCreate(true); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [canCreate]);
  const toggle = () => { setCollapsed((c) => { try { localStorage.setItem("epm_nav", c ? "0" : "1"); } catch {} return !c; }); };
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";

  return (
    <div className="flex min-h-screen">
      <aside className={clsx("glass border-e border-line sticky top-0 h-screen flex flex-col transition-all z-30 shrink-0", collapsed ? "w-[64px]" : "w-[232px]")} aria-label="Primary">
        <div className="flex items-center gap-2.5 px-4 h-14">
          <Logo size={26} />{!collapsed && <span className="font-semibold tracking-tight">Lumen PMO</span>}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {nav.map((n) => {
            const I = ICONS[n.icon];
            return (
              <div key={n.href}>
                {n.section && !collapsed && <div className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider muted">{n.section}</div>}
                {n.section && collapsed && <div className="my-2 mx-3 border-t border-line" />}
                <Link href={n.href} title={n.label} className={clsx("flex items-center gap-3 rounded-lg px-3 h-8 text-sm my-0.5", active(n.href) ? "bg-accent text-white" : "text-ink-2 hover:bg-black/5 dark:hover:bg-white/10")}>
                  <I className="h-4 w-4 shrink-0" />{!collapsed && <span className="truncate">{n.label}</span>}
                </Link>
              </div>
            );
          })}
        </nav>
        <button onClick={toggle} className="m-2 flex items-center gap-3 rounded-lg px-3 h-8 text-sm text-ink-3 hover:bg-black/5" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="glass sticky top-0 z-20 h-14 border-b border-line flex items-center gap-3 px-5">
          <div className="relative">
            <button className="btn-secondary btn-sm" onClick={() => setMenu(menu === "ws" ? null : "ws")} aria-haspopup="menu">{workspace.name}<ChevronDown className="h-3 w-3" /></button>
            {menu === "ws" && <div className="absolute mt-2 card shadow-pop py-1 min-w-[220px]" role="menu">
              {workspaces.map((w) => <button key={w.id} role="menuitem" className="block w-full text-start px-3 py-2 text-sm hover:bg-black/5" onClick={async () => { await apiFetch("/api/auth/workspace", { method: "POST", json: { workspaceId: w.id } }); setMenu(null); router.push("/"); router.refresh(); }}>{w.name}{w.id === workspace.id && " ✓"}</button>)}
            </div>}
          </div>
          <form className="flex-1 max-w-xl" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`); }}>
            <label className="relative block">
              <span className="sr-only">Search</span>
              <Search className="h-4 w-4 muted absolute start-3 top-1/2 -translate-y-1/2" />
              <input id="global-search" className="input !rounded-full ps-9 bg-black/[0.04] border-transparent" placeholder="Search issues, projects, people…  ( / )" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </form>
          <div className="flex-1" />
          {canCreate && <button className="btn-primary btn-sm" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Create</button>}
          <Link href="/notifications" className="relative btn-secondary btn-sm !px-2" aria-label={`Notifications (${unread} unread)`}>
            <Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -top-1 -end-1 bg-[#ff3b30] text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link href="/help" className="btn-secondary btn-sm !px-2" aria-label="Help"><HelpCircle className="h-4 w-4" /></Link>
          <div className="relative">
            <button onClick={() => setMenu(menu === "user" ? null : "user")} aria-haspopup="menu" aria-label="Account"><Avatar name={user.name} size={30} /></button>
            {menu === "user" && <div className="absolute end-0 mt-2 card shadow-pop py-1 min-w-[240px]" role="menu">
              <div className="px-3 py-2 border-b border-line"><div className="text-sm font-medium">{user.name}</div><div className="text-xs muted">{user.email}</div><div className="text-xs text-accent mt-0.5">{user.role}</div></div>
              <Link href="/profile" className="block px-3 py-2 text-sm hover:bg-black/5" onClick={() => setMenu(null)}>Profile & security</Link>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5" onClick={() => { document.cookie = `epm_lang=${lang === "ar" ? "en" : "ar"};path=/;max-age=31536000`; location.reload(); }}><Languages className="h-4 w-4" />{lang === "ar" ? "English" : "العربية"}</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-black/5 text-[#ff3b30]" onClick={async () => { await apiFetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}><LogOut className="h-4 w-4" />Sign out</button>
            </div>}
          </div>
        </header>
        <main className="px-6 py-6 max-w-[1500px] mx-auto" onClick={() => menu && setMenu(null)}>{children}</main>
      </div>
      <CreateIssueModal open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
