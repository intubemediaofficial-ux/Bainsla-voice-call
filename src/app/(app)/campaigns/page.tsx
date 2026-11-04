import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/campaign";
import { num, rupees } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const ctx = await requirePage("campaigns.read");
  const rows = await prisma.campaign.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "desc" }, take: 200, include: { purpose: { select: { name: true, category: true } } } });
  return (
    <>
      <PageHeader title="Campaigns" subtitle="Draft → review → approve → run. Every call is re-checked for consent, opt-out, caps and calling hours just before it is placed." actions={ctxCan(ctx, "campaigns.write") && <Link href="/campaigns/new" className="btn-primary"><Plus className="h-4 w-4" /> New campaign</Link>} />
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Megaphone} title="No campaigns yet" text="Upload contacts and an approved audio, then create your first campaign." action={<Link href="/campaigns/new" className="btn-primary">New campaign</Link>} /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Purpose</th><th>Status</th><th>Audience</th><th>Est. cost</th><th>Schedule</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/campaigns/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{c.name}</Link></td>
                    <td className="text-xs">{c.purpose.name}</td>
                    <td><span className={`badge ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                    <td>{num(c.audienceCount)}</td>
                    <td>{rupees(c.estimatedCostPaise)}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{c.scheduledAt ? fmtDateTime(c.scheduledAt) : "Start on approval"}</td>
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
