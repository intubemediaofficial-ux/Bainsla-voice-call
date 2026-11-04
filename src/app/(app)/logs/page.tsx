import Link from "next/link";
import { ClipboardList, Download } from "lucide-react";
import type { CallStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { duration, num, rupees } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Call logs" };
const STATUSES = ["QUEUED", "SUBMITTED", "RINGING", "IN_PROGRESS", "COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "REJECTED", "CANCELLED"];

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ campaign?: string; status?: string; page?: string }> }) {
  const ctx = await requirePage("calls.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.CallAttemptWhereInput = { tenantId: ctx.tenant.id, ...(sp.campaign ? { campaignId: sp.campaign } : {}), ...(STATUSES.includes(sp.status || "") ? { status: sp.status as CallStatus } : {}) };
  const [rows, total, campaigns] = await Promise.all([
    prisma.callAttempt.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { contact: { select: { phoneMasked: true } }, campaign: { select: { name: true } }, callerId: { select: { phoneE164: true } } } }),
    prisma.callAttempt.count({ where }),
    prisma.campaign.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, name: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const qs = (p: number) => `/logs?${new URLSearchParams({ ...(sp.campaign ? { campaign: sp.campaign } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Call logs" subtitle="Every call attempt with its result, duration and cost. Numbers are masked." actions={ctxCan(ctx, "reports.export") && <a href="/api/calls/export" className="btn-ghost"><Download className="h-4 w-4" /> Export CSV</a>} />
      <Card
        pad={false}
        title={`${num(total)} calls`}
        actions={
          <form className="flex flex-wrap gap-2" action="/logs">
            <select name="campaign" defaultValue={sp.campaign} className="input w-full py-2 sm:w-48"><option value="">All campaigns</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select name="status" defaultValue={sp.status} className="input w-36 py-2"><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</select>
            <button className="btn-ghost py-2">Filter</button>
          </form>
        }
      >
        {rows.length === 0 ? <Empty icon={ClipboardList} title="No calls found" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Number</th><th>Campaign</th><th>Caller ID</th><th>Status</th><th>Duration</th><th>Keypad</th><th>Cost</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.createdAt)}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{r.contact.phoneMasked}</td>
                    <td className="max-w-[180px] truncate">{r.campaignId ? <Link href={`/campaigns/${r.campaignId}`} className="hover:text-brand-600">{r.campaign?.name}</Link> : "Single call"}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{r.callerId.phoneE164}</td>
                    <td><StatusBadge s={r.status} />{r.attemptNo > 1 && <div className="text-[11px] text-slate-400">attempt {r.attemptNo}</div>}{r.failureReason && <div className="max-w-[180px] text-[11px] text-rose-500">{r.failureReason}</div>}</td>
                    <td>{duration(r.durationSeconds)}</td>
                    <td className="text-xs">{r.dtmf ? `${r.dtmf}${r.optedOut ? " (opt-out)" : ""}` : "—"}</td>
                    <td>{rupees(r.costPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 50 && (
          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-slate-500">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">{page > 1 && <Link className="btn-ghost py-1.5" href={qs(page - 1)}>Previous</Link>}{page * 50 < total && <Link className="btn-ghost py-1.5" href={qs(page + 1)}>Next</Link>}</div>
          </div>
        )}
      </Card>
    </>
  );
}
