import { requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { MfaSetup, PasswordForm } from "./form";

export const metadata = { title: "My account" };

export default async function ProfilePage() {
  const ctx = await requirePage(undefined, { allowSetup: true });
  return (
    <>
      <PageHeader title="My account" subtitle={`${ctx.user.name} · ${ctx.user.email} · ${ctx.user.role.toLowerCase()}`} />
      {ctx.user.mustChangePw && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Please set your own password before continuing.</div>}
      {ctx.tenant.requireMfa && !ctx.user.mfaEnabled && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Your organisation requires 2-step verification. Turn it on below.</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Change password"><PasswordForm /></Card>
        <Card title={<span className="flex items-center gap-2">2-step verification {ctx.user.mfaEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</span>}>
          <MfaSetup enabled={ctx.user.mfaEnabled} />
        </Card>
      </div>
    </>
  );
}
