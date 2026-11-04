import { BarChart3, Clock, IndianRupee, PhoneIncoming, ShieldBan } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { duration, num, pct, rupees } from "@/lib/format";
import { daysAgo, fromLocalInput } from "@/lib/time";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requirePage("reports.read");
  const sp = await searchParams;
  const to = sp.to ? fromLocalInput(`${sp.to}T23:59`) : new Date();
  const from = sp.from ? fromLocalInput(`${sp.from}T00:00`) : daysAgo(30);
  const where = { tenantId: ctx.tenant.id, createdAt: { gte: from ?? undefined, lte: to ?? undefined }, status: { not: "CANCELLED" as const } };
  const [byStatus, agg, optouts, byCampaign, campaigns] = await Promise.all([
    prisma.callAttempt.groupBy({ by: ["status"], where, _count: true }),
    prisma.callAttempt.aggregate({ where, _sum: { costPaise: true, durationSeconds: true }, _count: true }),
    prisma.callAttempt.count({ where: { ...where, optedOut: true } }),
    prisma.callAttempt.groupBy({ by: ["campaignId", "status"], where, _count: true, _sum: { costPaise: true } }),
    prisma.campaign.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, name: true } }),
  ]);
  const st = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>;
  const per: Record<string, { name: string; total: number; answered: number; cost: number }> = {};
  for (const r of byCampaign) {
    const k = r.campaignId ?? "single";
    per[k] ??= { name: campaigns.find((c) => c.id === r.campaignId)?.name ?? "Single calls", total: 0, answered: 0, cost: 0 };
    per[k].total += r._count;
    if (r.status === "COMPLETED") per[k].answered += r._count;
    per[k].cost += r._sum.costPaise ?? 0;
  }
  const iso = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : "");
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Outcome of your calls for the selected dates."
        actions={
          <form className="flex flex-wrap items-end gap-2" action="/reports">
            <div><label className="label">From</label><input type="date" name="from" defaultValue={iso(from)} className="input py-2" /></div>
            <div><label className="label">To</label><input type="date" name="to" defaultValue={iso(to)} className="input py-2" /></div>
            <button className="btn-primary py-2">Show</button>
          </form>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Calls" value={num(agg._count)} icon={BarChart3} />
        <Stat label="Answered" value={pct(st.COMPLETED ?? 0, agg._count)} hint={`${num(st.COMPLETED ?? 0)} calls`} icon={PhoneIncoming} tone="green" />
        <Stat label="Talk time" value={duration(agg._sum.durationSeconds ?? 0)} icon={Clock} tone="sky" hint={`Cost ${rupees(agg._sum.costPaise ?? 0)}`} />
        <Stat label="Opt-outs" value={num(optouts)} icon={ShieldBan} tone="rose" hint={pct(optouts, st.COMPLETED ?? 0) + " of answered"} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Outcomes">
          <ul className="space-y-3">
            {Object.entries(st).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <li key={s}>
                <div className="flex justify-between text-sm"><span>{s.replace("_", " ").toLowerCase()}</span><b>{num(n)}</b></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(n * 100) / Math.max(1, agg._count)}%` }} /></div>
              </li>
            ))}
            {agg._count === 0 && <li className="text-sm text-slate-500">No calls in this period.</li>}
          </ul>
        </Card>
        <Card title="By campaign" pad={false} className="xl:col-span-2">
          {Object.keys(per).length === 0 ? <Empty icon={IndianRupee} title="Nothing to show" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Campaign</th><th>Calls</th><th>Answered</th><th>Rate</th><th>Cost</th></tr></thead>
                <tbody>{Object.entries(per).map(([k, v]) => <tr key={k}><td className="font-medium">{v.name}</td><td>{num(v.total)}</td><td>{num(v.answered)}</td><td>{pct(v.answered, v.total)}</td><td>{rupees(v.cost)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
