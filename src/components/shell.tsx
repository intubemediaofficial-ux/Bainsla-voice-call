"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AudioLines, BarChart3, Building2, ClipboardList, FileClock, GitBranch, LayoutDashboard, LogOut, Megaphone, Menu, PhoneCall, PhoneOutgoing,
  Receipt, Settings, ShieldBan, ShieldCheck, UserCircle2, Users, UsersRound, X, OctagonX,
} from "lucide-react";
import { send } from "./client";

export type NavItem = { href: string; label: string; icon: string };

const ICONS = {
  LayoutDashboard, Users, ShieldCheck, ShieldBan, PhoneCall, AudioLines, Megaphone, PhoneOutgoing, GitBranch, ClipboardList, BarChart3, Receipt, UsersRound, Settings, FileClock, Building2,
};

export function Shell({
  nav, user, tenant, stopped, children, tenants,
}: {
  nav: { section: string; items: NavItem[] }[];
  user: { name: string; email: string; role: string };
  tenant: { id: string; name: string };
  stopped: boolean;
  tenants?: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const side = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-saffron-500 shadow-lg shadow-brand-600/30">
          <AudioLines className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-[15px] font-bold leading-tight text-white">Bainsla Voice</div>
          <div className="text-[11px] text-white/50">Consent-first calling</div>
        </div>
      </div>
      {tenants && tenants.length > 1 ? (
        <div className="px-4 pb-3">
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white outline-none"
            value={tenant.id}
            onChange={async (e) => {
              await send("POST", "/api/platform/view", { tenantId: e.target.value });
              router.refresh();
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="text-slate-900">
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mx-4 mb-3 truncate rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70">{tenant.name}</div>
      )}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {nav.map((sec) => (
          <div key={sec.section}>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{sec.section}</div>
            {sec.items.map((it) => {
              const Icon = ICONS[it.icon as keyof typeof ICONS] ?? LayoutDashboard;
              const active = path === it.href || (it.href !== "/dashboard" && path.startsWith(it.href + "/")) || path === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-white/10 text-white shadow-inner" : "text-white/65 hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-saffron-400" : "text-white/45 group-hover:text-white/80"}`} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/profile" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
          <UserCircle2 className="h-8 w-8 text-white/60" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="truncate text-[11px] text-white/50">{user.role.toLowerCase()} · {user.email}</div>
          </div>
        </Link>
        <button
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
          onClick={async () => {
            await send("POST", "/api/auth/logout");
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink-900 lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-ink-900">
            <button className="absolute right-3 top-5 text-white/70" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {side}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-ink-900 hover:bg-slate-100">
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-bold text-ink-900">Bainsla Voice</div>
        </header>
        {stopped && (
          <div className="flex items-center gap-2 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white">
            <OctagonX className="h-4 w-4 shrink-0" /> Emergency stop is ON — no calls are being placed.
            <Link href="/settings" className="ml-auto underline">Manage</Link>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
