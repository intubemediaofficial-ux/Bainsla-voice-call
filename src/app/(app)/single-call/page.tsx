import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { SingleCallForm } from "./form";

export const metadata = { title: "Single call" };

export default async function SingleCallPage() {
  const ctx = await requirePage("calls.single");
  const t = ctx.tenant.id;
  const [purposes, audio, callerIds] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: t, active: true, category: { not: "POLITICAL" } } }),
    prisma.audioAsset.findMany({ where: { tenantId: t, approvalStatus: "APPROVED", forPolitical: false } }),
    prisma.callerId.findMany({ where: { tenantId: t, verificationStatus: "VERIFIED", providerKey: ctx.tenant.providerKey } }),
  ]);
  return (
    <>
      <PageHeader title="Single call" subtitle="Play an approved message to one consented contact right now. Election messages can only go out as an approved campaign." />
      <Card className="max-w-2xl">
        <SingleCallForm
          purposes={purposes.map((p) => ({ id: p.id, name: p.name, category: p.category }))}
          audio={audio.map((a) => ({ id: a.id, name: `${a.name} v${a.version}` }))}
          callerIds={callerIds.map((c) => ({ id: c.id, name: `${c.label} · ${c.phoneE164}`, categories: c.approvedCategories }))}
        />
      </Card>
    </>
  );
}
