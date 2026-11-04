import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { IVR_ACTION_LABEL, type IvrDefinition } from "@/lib/ivr";
import { IvrEditor } from "./form";

export const metadata = { title: "IVR flows" };

export default async function IvrPage() {
  const ctx = await requirePage("ivr.read");
  const flows = await prisma.ivrFlow.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "asc" } });
  const write = ctxCan(ctx, "ivr.write");
  return (
    <>
      <PageHeader title="IVR flows" subtitle="Keypad options played after your message. Key 9 always opts the person out." />
      <div className="grid gap-6 xl:grid-cols-2">
        {flows.map((fl) => {
          const d = fl.definition as unknown as IvrDefinition;
          return (
            <Card key={fl.id} title={<span className="flex items-center gap-2">{fl.name} <Badge tone="violet">v{fl.version}</Badge></span>}>
              {write ? <IvrEditor id={fl.id} name={fl.name} def={d} /> : (
                <ul className="space-y-1 text-sm">{d.options.map((o) => <li key={o.digit}><b>{o.digit}</b> — {o.label || IVR_ACTION_LABEL[o.action]}</li>)}</ul>
              )}
            </Card>
          );
        })}
        {write && <Card title="New flow"><IvrEditor /></Card>}
      </div>
    </>
  );
}
