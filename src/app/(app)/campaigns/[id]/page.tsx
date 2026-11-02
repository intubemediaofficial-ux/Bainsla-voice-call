import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { STATUS_LABEL, STATUS_STYLE, validateCampaign } from "@/lib/campaign";
import { duration, num, pct, rupees } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";
import { AutoRefresh } from "./refresh";

export const metadata = { title: "Campaign" };

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage("campaigns.read");
  const { id } = await params;
  const c = await prisma.campaign.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { purpose: true, audioAsset: true, callerId: true, ivrFlow: true } });
  if (!c) notFound();
  const [counts, attempts, agg, v] = await Promise.all([
    prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: true }),
    prisma.callAttempt.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "desc" }, take: 30, include: { contact: { select: { phoneMasked: true } } } }),
    prisma.callAttempt.aggregate({ where: { campaignId: c.id }, _sum: { costPaise: true, durationSeconds: true }, _count: true }),
    ["DRAFT", "NEEDS_REVIEW", "APPROVED", "PAUSED"].includes(c.status) ? validateCampaign(c) : Promise.resolve(null),
  ]);
  const cnt = Object.fromEntries(counts.map((x) => [x.status, x._count])) as Record<string, number>;
  const total = Object.values(cnt).reduce((a, b) => a + b, 0);
  const done = (cnt.COMPLETED ?? 0) + (cnt.FAILED ?? 0) + (cnt.SKIPPED ?? 0) + (cnt.CANCELLED ?? 0);
  const answered = await prisma.callAttempt.count({ where: { campaignId: c.id, status: "COMPLETED" } });
  const optouts = await prisma.callAttempt.count({ where: { campaignId: c.id, optedOut: true } });
  const can = (p: Parameters<typeof ctxCan>[1]) => ctxCan(ctx, p);
  const act = (a: string, label: string, cls = "btn-ghost", extra: { confirm?: string; prompt?: string } = {}) => (
    <ActionButton url={`/api/campaigns/${c.id}/action`} body={{ action: a }} className={cls} {...extra}>{label}</ActionButton>
  );
  return (
    <>
      {["RUNNING", "SCHEDULED"].includes(c.status) && <AutoRefresh />}
      <PageHeader
        title={c.name}
        subtitle={`${c.purpose.name} · ${c.callerId.phoneE164} · ${c.audioAsset.name} v${c.audioAsset.version}`}
        actions={
          <>
            <span className={`badge self-center ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
            {c.status === "DRAFT" && can("campaigns.write") && act("submit", "Submit for review", "btn-primary")}
            {c.status === "NEEDS_REVIEW" && can("campaigns.approve") && act("approve", c.needsSecondApproval && c.approvedById ? "Give second approval" : "Approve", "btn-primary")}
            {["NEEDS_REVIEW", "APPROVED"].includes(c.status) && can("campaigns.approve") && act("reject", "Send back", "btn-ghost", { prompt: "What needs to change?" })}
            {c.status === "APPROVED" && can("campaigns.control") && act("start", c.scheduledAt && c.scheduledAt > new Date() ? "Schedule" : "Start calling", "btn-primary", { confirm: `Start calling ${num(v?.audience ?? c.audienceCount)} people now?` })}
            {["RUNNING", "SCHEDULED"].includes(c.status) && can("campaigns.control") && act("pause", "Pause")}
            {c.status === "PAUSED" && can("campaigns.control") && act("resume", "Resume", "btn-primary")}
            {!["COMPLETED", "CANCELLED", "FAILED"].includes(c.status) && can("campaigns.control") && act("cancel", "Cancel", "btn-danger", { confirm: "Cancel this campaign? Remaining calls will not be placed." })}
            {can("reports.export") && total > 0 && <a className="btn-ghost" href={`/api/campaigns/${c.id}/export`}><Download className="h-4 w-4" /> CSV</a>}
          </>
        }
      />
      {c.reviewNote && c.status === "DRAFT" && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Sent back: {c.reviewNote}</div>}
      {c.failureReason && c.status === "PAUSED" && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{c.failureReason}</div>}
      {c.needsSecondApproval && c.status === "NEEDS_REVIEW" && <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">Large campaign: needs approval from two different people.{c.approvedById ? " First approval done." : ""}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[["Recipients", num(total || c.audienceCount)], ["Progress", total ? pct(done, total) : "—"], ["Answered", `${num(answered)} (${pct(answered, agg._count)})`], ["Opted out", num(optouts)], ["Spent", `${rupees(agg._sum.costPaise ?? 0)} / est. ${rupees(c.estimatedCostPaise)}`]].map(([k, val]) => (
          <div key={k} className="card p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</div><div className="mt-1 text-lg font-bold text-ink-900">{val}</div></div>
        ))}
      </div>
      {total > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {[["COMPLETED", "bg-emerald-500"], ["IN_PROGRESS", "bg-violet-500"], ["QUEUED", "bg-sky-400"], ["FAILED", "bg-rose-500"], ["SKIPPED", "bg-amber-400"], ["CANCELLED", "bg-slate-400"]].map(([s, col]) => (
              <div key={s} className={col} style={{ width: `${((cnt[s] ?? 0) * 100) / total}%` }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">{Object.entries(cnt).map(([s, n]) => <span key={s}>{s.replace("_", " ").toLowerCase()}: <b>{num(n)}</b></span>)}</div>
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {v && (
          <Card title="Pre-launch checks">
            <ul className="space-y-3">
              {v.items.map((i) => (
                <li key={i.key} className="flex gap-2 text-sm">
                  {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                  <div><div className="font-semibold text-ink-900">{i.label}</div><div className="text-xs text-slate-500">{i.detail}</div></div>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Estimated cost: <b>{rupees(v.costPaise)}</b> for {num(v.audience)} calls</div>
          </Card>
        )}
        <Card title="Details" className={v ? "" : "xl:col-span-1"}>
          <dl className="space-y-2 text-sm">
            {[["Audience tags", c.segmentTags.join(", ") || "All consented contacts"], ["Calling hours", `${c.windowStart}–${c.windowEnd} IST`], ["Start", c.scheduledAt ? fmtDateTime(c.scheduledAt) : "On approval"], ["Limits", `${num(c.dailyCap)}/day · ${c.concurrency} at once`], ["IVR", c.ivrFlow?.name ?? "None (9 opts out)"], ["Consent basis", c.consentBasis], ["Opt-out", c.optOutMethod], ["Created", fmtDateTime(c.createdAt)]].map(([k, val]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-slate-500">{k}</dt><dd className="text-ink-900">{val}</dd></div>
            ))}
          </dl>
          <audio controls preload="none" src={`/api/audio/${c.audioAssetId}/stream`} className="mt-4 w-full" />
        </Card>
        <Card title="Latest calls" pad={false} className={v ? "" : "xl:col-span-2"} actions={<Link href={`/logs?campaign=${c.id}`} className="text-xs font-semibold text-brand-600">All</Link>}>
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}><td className="font-mono text-xs">{a.contact.phoneMasked}</td><td><StatusBadge s={a.status} /></td><td className="text-xs">{duration(a.durationSeconds)}{a.optedOut ? " · opted out" : ""}</td><td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(a.createdAt)}</td></tr>
                ))}
                {attempts.length === 0 && <tr><td className="text-sm text-slate-500">No calls yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
