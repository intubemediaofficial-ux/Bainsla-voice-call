import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { fmtDate } from "@/lib/time";
import { num } from "@/lib/format";

export const metadata = { title: "Consent records" };

export default async function ConsentsPage({ searchParams }: { searchParams: Promise<{ purpose?: string; state?: string }> }) {
  const ctx = await requirePage("contacts.read");
  const sp = await searchParams;
  const now = new Date();
  const t = ctx.tenant.id;
  const where = {
    tenantId: t,
    ...(sp.purpose ? { purposeId: sp.purpose } : {}),
    ...(sp.state === "revoked" ? { revokedAt: { not: null } } : sp.state === "expired" ? { revokedAt: null, expiresAt: { lte: now } } : sp.state === "active" ? { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}),
  };
  const [purposes, rows, total, byPurpose] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: t }, orderBy: { name: "asc" } }),
    prisma.consentRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { contact: { select: { phoneMasked: true } }, purpose: { select: { name: true } } } }),
    prisma.consentRecord.count({ where }),
    prisma.consentRecord.groupBy({ by: ["purposeId"], where: { tenantId: t, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, _count: true }),
  ]);
  const canWrite = ctxCan(ctx, "contacts.write");
  return (
    <>
      <PageHeader title="Consent records" subtitle="Proof of who agreed to which kind of call, when and how. Calls are only placed against an active record for the campaign's purpose." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {purposes.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.name}</div>
            <div className="mt-1 text-2xl font-bold text-ink-900">{num(byPurpose.find((b) => b.purposeId === p.id)?._count ?? 0)}</div>
            <div className="text-xs text-slate-500">active consents</div>
          </div>
        ))}
      </div>
      <Card
        pad={false}
        title={`Records (${num(total)})`}
        actions={
          <form className="flex flex-wrap gap-2" action="/consents">
            <select name="purpose" defaultValue={sp.purpose} className="input w-full py-2 sm:w-44"><option value="">All purposes</option>{purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select name="state" defaultValue={sp.state} className="input w-32 py-2"><option value="">Any state</option><option value="active">Active</option><option value="expired">Expired</option><option value="revoked">Revoked</option></select>
            <button className="btn-ghost py-2">Filter</button>
          </form>
        }
      >
        {rows.length === 0 ? <Empty icon={ShieldCheck} title="No consent records" text="Consent is recorded when you upload contacts." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Number</th><th>Purpose</th><th>Source</th><th>Evidence</th><th>Granted</th><th>State</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const state = r.revokedAt ? "revoked" : r.expiresAt && r.expiresAt <= now ? "expired" : "active";
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{r.contact.phoneMasked}</td>
                      <td>{r.purpose.name}</td>
                      <td className="max-w-[200px] text-xs">{r.source}<div className="text-slate-400">{r.channel}</div></td>
                      <td className="text-xs">{r.evidenceRef}</td>
                      <td className="whitespace-nowrap text-xs">{fmtDate(r.grantedAt)}{r.expiresAt && <div className="text-slate-400">until {fmtDate(r.expiresAt)}</div>}</td>
                      <td>{state === "active" ? <Badge tone="green">Active</Badge> : state === "expired" ? <Badge tone="amber">Expired</Badge> : <Badge tone="rose">Revoked</Badge>}</td>
                      <td>{canWrite && state === "active" && <ActionButton url={`/api/consents/${r.id}`} className="text-xs font-semibold text-rose-600" prompt="Reason for revoking (optional)">Revoke</ActionButton>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
