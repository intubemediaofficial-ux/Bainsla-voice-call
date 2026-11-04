import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import { AddStaff, StaffActions } from "./form";

export const metadata = { title: "Staff & roles" };

const ROLE_HELP: Record<string, string> = {
  ADMIN: "Everything incl. settings, staff, approvals, emergency stop",
  MANAGER: "Approve audio & campaigns, run campaigns, reports",
  OPERATOR: "Import contacts, upload audio, draft campaigns, single calls",
  AUDITOR: "Read-only: logs, consent, reports, audit trail",
};

export default async function StaffPage() {
  const ctx = await requirePage("staff.manage");
  const users = await prisma.user.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Staff & roles" subtitle="Give each person only the access they need." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Add staff"><AddStaff /></Card>
        <Card title="Roles" className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(ROLE_HELP).map(([r, h]) => <div key={r} className="rounded-xl bg-slate-50 p-3"><Badge tone="violet">{r.toLowerCase()}</Badge><p className="mt-1.5 text-sm text-slate-600">{h}</p></div>)}</div>
        </Card>
      </div>
      <Card title={`Team (${users.length})`} pad={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>2-step</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><div className="font-semibold text-ink-900">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                  <td><Badge tone="violet">{u.role.toLowerCase()}</Badge>{u.isPlatformAdmin && <Badge tone="orange">platform</Badge>}</td>
                  <td>{u.status === "ACTIVE" ? <Badge tone="green">Active</Badge> : <Badge tone="rose">Disabled</Badge>}</td>
                  <td>{u.mfaEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</td>
                  <td className="whitespace-nowrap text-xs text-slate-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Never"}</td>
                  <td>{u.id !== ctx.user.id && <StaffActions id={u.id} role={u.role} status={u.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
