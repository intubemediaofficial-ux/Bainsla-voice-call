import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, type Perm } from "@/lib/rbac";
import { platformStopped } from "@/lib/eligibility";
import { Shell, type NavItem } from "@/components/shell";

export const dynamic = "force-dynamic";

const NAV: { section: string; items: (NavItem & { perm: Perm })[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", perm: "contacts.read" },
      { href: "/setup", label: "Go-live setup", icon: "ListChecks", perm: "settings.manage" },
    ],
  },
  {
    section: "Audience",
    items: [
      { href: "/contacts", label: "Contacts & import", icon: "Users", perm: "contacts.read" },
      { href: "/consents", label: "Consent records", icon: "ShieldCheck", perm: "contacts.read" },
      { href: "/suppression", label: "Opt-out / DND", icon: "ShieldBan", perm: "contacts.read" },
    ],
  },
  {
    section: "Calling",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: "Megaphone", perm: "campaigns.read" },
      { href: "/single-call", label: "Single call", icon: "PhoneOutgoing", perm: "calls.single" },
      { href: "/audio", label: "Audio library", icon: "AudioLines", perm: "audio.read" },
      { href: "/caller-ids", label: "Caller IDs", icon: "PhoneCall", perm: "callerids.read" },
      { href: "/ivr", label: "IVR flows", icon: "GitBranch", perm: "ivr.read" },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/logs", label: "Call logs", icon: "ClipboardList", perm: "calls.read" },
      { href: "/reports", label: "Reports", icon: "BarChart3", perm: "reports.read" },
      { href: "/billing", label: "Usage & billing", icon: "Receipt", perm: "billing.read" },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/staff", label: "Staff & roles", icon: "UsersRound", perm: "staff.manage" },
      { href: "/settings", label: "Settings", icon: "Settings", perm: "settings.manage" },
      { href: "/audit", label: "Audit log", icon: "FileClock", perm: "audit.read" },
    ],
  },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage(undefined, { allowSetup: true });
  const nav = NAV.map((s) => ({ section: s.section, items: s.items.filter((i) => can(ctx.user.role, i.perm)).map((i) => ({ href: i.href, label: i.label, icon: i.icon })) })).filter((s) => s.items.length);
  if (ctx.user.isPlatformAdmin) nav.push({ section: "Platform", items: [{ href: "/platform", label: "Organisations", icon: "Building2" }] });
  const tenants = ctx.user.isPlatformAdmin ? await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }) : undefined;
  return (
    <Shell nav={nav} user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.user.role }} tenant={{ id: ctx.tenant.id, name: ctx.tenant.name }} stopped={ctx.tenant.emergencyStop || (await platformStopped())} tenants={tenants}>
      {children}
    </Shell>
  );
}
