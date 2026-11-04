import Link from "next/link";
import { Activity, AlertTriangle, IndianRupee, Megaphone, PhoneCall, PhoneIncoming, ShieldBan, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { num, pct, rupees } from "@/lib/format";
import { dateKey, fmtDateTime, startOfDayInTz } from "@/lib/time";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/campaign";
import { CallsChart } from "./chart";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const t = ctx.tenant.id;
  const today = startOfDayInTz(new Date());
  const since = new Date(today.getTime() - 13 * 86400_000);
  const [todayCalls, todayConnected, todayCost, contacts, suppressed, active, recent, alerts, series] = await Promise.all([
    prisma.callAttempt.count({ where: { tenantId: t, createdAt: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.callAttempt.count({ where: { tenantId: t, createdAt: { gte: today }, status: "COMPLETED" } }),
    prisma.callAttempt.aggregate({ where: { tenantId: t, createdAt: { gte: today } }, _sum: { costPaise: true } }),
    prisma.contact.count({ where: { tenantId: t } }),
    prisma.suppression.count({ where: { tenantId: t } }),
    prisma.campaign.findMany({ where: { tenantId: t, status: { in: ["RUNNING", "SCHEDULED", "PAUSED", "NEEDS_REVIEW", "APPROVED"] } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.callAttempt.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 8, include: { contact: { select: { phoneMasked: true } }, campaign: { select: { name: true } } } }),
    prisma.alert.findMany({ where: { tenantId: t, resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.callAttempt.findMany({ where: { tenantId: t, createdAt: { gte: since }, status: { not: "CANCELLED" } }, select: { createdAt: true, status: true } }),
  ]);
  const days: Record<string, { day: string; calls: number; connected: number }> = {};
  for (let i = 0; i < 14; i++) {
    const k = dateKey(new Date(since.getTime() + i * 86400_000 + 3600_000));
    days[k] = { day: k.slice(5), calls: 0, connected: 0 };
  }
  for (const s of series) {
    const d = days[dateKey(s.createdAt)];
    if (d) {
      d.calls++;
      if (s.status === "COMPLETED") d.connected++;
    }
  }
  return (
    <>
      <PageHeader
        title={`Welcome, ${ctx.user.name.split(" ")[0]}`}
        subtitle={`${ctx.tenant.name} · calling window ${ctx.tenant.callWindowStart}–${ctx.tenant.callWindowEnd} IST`}
        actions={<><Link href="/contacts" className="btn-ghost">Import contacts</Link><Link href="/campaigns/new" className="btn-primary">New campaign</Link></>}
      />
      {sp.denied && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Your role does not have access to that page.</div>}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${a.level === "critical" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
              <AlertTriangle className="h-4 w-4 shrink-0" /> {a.message} <span className="ml-auto text-xs opacity-70">{fmtDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Calls today" value={num(todayCalls)} icon={PhoneCall} hint={`${num(todayConnected)} answered`} />
        <Stat label="Answer rate" value={pct(todayConnected, todayCalls)} icon={PhoneIncoming} tone="green" hint="today" />
        <Stat label="Spend today" value={rupees(todayCost._sum.costPaise ?? 0)} icon={IndianRupee} tone="amber" hint={`${rupees(ctx.tenant.ratePerMinutePaise)} / min`} />
        <Stat label="Contacts" value={num(contacts)} icon={Users} tone="sky" hint={<span className="inline-flex items-center gap-1"><ShieldBan className="h-3 w-3" /> {num(suppressed)} opted out</span>} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Last 14 days" className="xl:col-span-2">
          <CallsChart data={Object.values(days)} />
        </Card>
        <Card title="Active campaigns" actions={<Link className="text-xs font-semibold text-brand-600" href="/campaigns">View all</Link>} pad={false}>
          {active.length === 0 ? (
            <Empty icon={Megaphone} title="No active campaigns" text="Create a campaign to start calling your consented contacts." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {active.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{num(c.audienceCount)} recipients</div>
                    </div>
                    <span className={`badge ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title={<span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-brand-600" /> Recent calls</span>} className="mt-6" pad={false} actions={<Link className="text-xs font-semibold text-brand-600" href="/logs">Call logs</Link>}>
        {recent.length === 0 ? (
          <Empty icon={PhoneCall} title="No calls yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.contact.phoneMasked}</td>
                    <td>{r.campaign?.name ?? "Single call"}</td>
                    <td><StatusBadge s={r.status} /></td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
