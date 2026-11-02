import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { platformStopped } from "@/lib/eligibility";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { num, rupees } from "@/lib/format";
import { fmtDate } from "@/lib/time";
import { NewTenant } from "./form";

export const metadata = { title: "Organisations" };

export default async function PlatformPage() {
  const ctx = await requirePage();
  if (!ctx.user.isPlatformAdmin) redirect("/dashboard?denied=1");
  const [tenants, stopped] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { contacts: true, campaigns: true, callAttempts: true, users: true } } } }),
    platformStopped(),
  ]);
  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="Platform admin: every customer account on Bainsla Voice."
        actions={<ActionButton url="/api/platform/stop" body={{ on: !stopped }} className={stopped ? "btn-primary" : "btn-danger"} confirm={stopped ? "Allow calls again on the whole platform?" : "Stop ALL calls for ALL organisations?"}>{stopped ? "Lift global stop" : "Global emergency stop"}</ActionButton>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="New organisation"><NewTenant /></Card>
        <Card title={`All organisations (${tenants.length})`} pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Name</th><th>Status</th><th>Usage</th><th>Rate</th><th>Since</th><th /></tr></thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold text-ink-900">{t.name}<div className="text-xs font-normal text-slate-400">{t.providerKey}{t.politicalEnabled ? " · political" : ""}</div></td>
                    <td>{t.status === "ACTIVE" ? <Badge tone="green">Active</Badge> : <Badge tone="rose">Suspended</Badge>}{t.emergencyStop && <Badge tone="rose">Stopped</Badge>}</td>
                    <td className="text-xs">{num(t._count.contacts)} contacts · {num(t._count.campaigns)} campaigns · {num(t._count.callAttempts)} calls · {t._count.users} staff</td>
                    <td>{rupees(t.ratePerMinutePaise)}/min</td>
                    <td className="text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      <ActionButton url="/api/platform/view" body={{ tenantId: t.id }} className="text-xs font-semibold text-brand-600">Open</ActionButton>
                      {t.id !== ctx.user.tenantId && <ActionButton url="/api/platform/tenants" method="PATCH" body={{ id: t.id, status: t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }} className="text-xs font-semibold text-slate-500" confirm="Change this organisation's status?">{t.status === "ACTIVE" ? "Suspend" : "Activate"}</ActionButton>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
