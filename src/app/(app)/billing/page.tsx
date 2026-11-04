import { IndianRupee, PhoneCall, Receipt, Timer } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader, Stat } from "@/components/ui";
import { num, rupees } from "@/lib/format";

export const metadata = { title: "Usage & billing" };

export default async function BillingPage() {
  const ctx = await requirePage("billing.read");
  const rows = await prisma.$queryRaw<{ month: string; calls: bigint; secs: bigint; paise: bigint }[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month, count(*) AS calls,
           coalesce(sum("durationSeconds"),0) AS secs, coalesce(sum("costPaise"),0) AS paise
    FROM "CallAttempt" WHERE "tenantId" = ${ctx.tenant.id} AND status <> 'CANCELLED' GROUP BY 1 ORDER BY 1 DESC LIMIT 12`;
  const cur = rows[0];
  return (
    <>
      <PageHeader title="Usage & billing" subtitle={`Billed per started minute of answered calls at ${rupees(ctx.tenant.ratePerMinutePaise)} / minute.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="This month — calls" value={num(Number(cur?.calls ?? 0))} icon={PhoneCall} />
        <Stat label="This month — minutes" value={num(Math.ceil(Number(cur?.secs ?? 0) / 60))} icon={Timer} tone="sky" />
        <Stat label="This month — amount" value={rupees(Number(cur?.paise ?? 0))} icon={IndianRupee} tone="amber" />
      </div>
      <Card title={<span className="inline-flex items-center gap-2"><Receipt className="h-4 w-4 text-brand-600" /> Monthly statement</span>} className="mt-6" pad={false}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Month</th><th>Calls</th><th>Minutes</th><th>Amount</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.month}><td className="font-medium">{r.month}</td><td>{num(Number(r.calls))}</td><td>{num(Math.ceil(Number(r.secs) / 60))}</td><td>{rupees(Number(r.paise))}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan={4} className="text-slate-500">No usage yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
