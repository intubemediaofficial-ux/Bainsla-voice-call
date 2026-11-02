import { ShieldBan } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { fmtDateTime } from "@/lib/time";
import { num } from "@/lib/format";
import { AddSuppression } from "./form";

export const metadata = { title: "Opt-out / DND" };

const REASON: Record<string, string> = { OPT_OUT_IVR: "Pressed 9 on call", OPT_OUT_WEB: "Opt-out page", MANUAL: "Added by staff", DND: "DND registry", COMPLAINT: "Complaint" };

export default async function SuppressionPage() {
  const ctx = await requirePage("contacts.read");
  const [rows, total] = await Promise.all([
    prisma.suppression.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.suppression.count({ where: { tenantId: ctx.tenant.id } }),
  ]);
  return (
    <>
      <PageHeader title="Opt-out / Do-not-call" subtitle="Numbers here are never called, whatever list or campaign they appear in. Public opt-out page: /opt-out" />
      {ctxCan(ctx, "suppression.write") && <Card title="Add numbers" className="mb-6"><AddSuppression /></Card>}
      <Card title={`Blocked numbers (${num(total)})`} pad={false}>
        {rows.length === 0 ? <Empty icon={ShieldBan} title="Nobody has opted out yet" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Number</th><th>Reason</th><th>Note</th><th>When</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{r.phoneMasked}</td>
                    <td><Badge tone={r.reason === "MANUAL" ? "slate" : "rose"}>{REASON[r.reason]}</Badge></td>
                    <td className="text-xs">{r.note}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.createdAt)}</td>
                    <td>{r.reason === "MANUAL" && ctxCan(ctx, "settings.manage") && <ActionButton url={`/api/suppressions/${r.id}`} method="DELETE" className="text-xs font-semibold text-slate-500" confirm="Remove this number from the block list?">Remove</ActionButton>}</td>
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
