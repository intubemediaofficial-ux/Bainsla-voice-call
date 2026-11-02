import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "../form";

export const metadata = { title: "New campaign" };

export default async function NewCampaign() {
  const ctx = await requirePage("campaigns.write");
  const t = ctx.tenant.id;
  const [purposes, audio, callerIds, ivr, tags] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: t, active: true }, orderBy: { name: "asc" } }),
    prisma.audioAsset.findMany({ where: { tenantId: t, approvalStatus: "APPROVED" }, orderBy: { createdAt: "desc" } }),
    prisma.callerId.findMany({ where: { tenantId: t, verificationStatus: "VERIFIED", providerKey: ctx.tenant.providerKey } }),
    prisma.ivrFlow.findMany({ where: { tenantId: t } }),
    prisma.$queryRaw<{ tag: string; n: bigint }[]>`SELECT unnest(tags) AS tag, count(*) AS n FROM "Contact" WHERE "tenantId" = ${t} GROUP BY 1 ORDER BY 2 DESC LIMIT 60`,
  ]);
  return (
    <>
      <PageHeader title="New campaign" subtitle="Only provider-verified caller IDs and approved audio can be chosen." />
      <CampaignForm
        purposes={purposes.filter((p) => p.category !== "POLITICAL" || ctx.tenant.politicalEnabled).map((p) => ({ id: p.id, name: p.name, category: p.category }))}
        audio={audio.map((a) => ({ id: a.id, name: `${a.name} v${a.version} (${Math.round(a.durationSeconds)}s)`, political: a.forPolitical }))}
        callerIds={callerIds.map((c) => ({ id: c.id, name: `${c.label} · ${c.phoneE164}`, categories: c.approvedCategories }))}
        ivr={ivr.map((i) => ({ id: i.id, name: i.name }))}
        tags={tags.map((x) => ({ tag: x.tag, n: Number(x.n) }))}
        defaults={{ windowStart: ctx.tenant.callWindowStart, windowEnd: ctx.tenant.callWindowEnd, concurrency: ctx.tenant.defaultConcurrency }}
      />
    </>
  );
}
