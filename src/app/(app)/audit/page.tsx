import { Download, FileClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePage("audit.read");
  const sp = await searchParams;
  const rows = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenant.id, ...(sp.q ? { action: { contains: sp.q } } : {}) }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Tamper-proof record of every important action. Entries cannot be edited or deleted." actions={<a href="/api/audit/export" className="btn-ghost"><Download className="h-4 w-4" /> Export CSV</a>} />
      <Card pad={false} title="Latest 200 entries" actions={<form action="/audit" className="flex gap-2"><input name="q" defaultValue={sp.q} className="input w-full py-2 sm:w-48" placeholder="Filter action e.g. campaign" /><button className="btn-ghost py-2">Filter</button></form>}>
        {rows.length === 0 ? <Empty icon={FileClock} title="No entries" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.createdAt)}</td>
                    <td className="text-xs">{r.actorEmail ?? "system"}<div className="text-slate-400">{r.ip}</div></td>
                    <td className="font-mono text-xs font-semibold text-ink-900">{r.action}</td>
                    <td className="text-xs">{r.entityType}</td>
                    <td className="max-w-md truncate font-mono text-[11px] text-slate-500" title={JSON.stringify(r.metadata)}>{JSON.stringify(r.metadata)}</td>
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
