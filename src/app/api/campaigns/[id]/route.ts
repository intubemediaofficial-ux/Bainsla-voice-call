import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { validateCampaign } from "@/lib/campaign";
import { CampaignInput, checkRefs } from "../route";

type P = { id: string };

export const GET = route<P>("campaigns.read", async ({ ctx, params }) => {
  const c = await prisma.campaign.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  const counts = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: true });
  const inflight = await prisma.callAttempt.count({ where: { campaignId: c.id, status: { in: ["QUEUED", "SUBMITTED", "RINGING", "IN_PROGRESS"] } } });
  return { status: c.status, counts: Object.fromEntries(counts.map((x) => [x.status, x._count])), inflight, validation: c.status === "DRAFT" ? await validateCampaign(c) : null };
});

export const PATCH = route<P>("campaigns.write", async ({ req, ctx, params }) => {
  const c = await prisma.campaign.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  if (c.status !== "DRAFT") throw new ApiError(400, "Only drafts can be edited");
  const b = await body(req, CampaignInput);
  const { scheduledAt } = await checkRefs(ctx.tenant.id, b);
  await prisma.campaign.update({ where: { id: c.id }, data: { ...b, ivrFlowId: b.ivrFlowId || null, segmentTags: b.segmentTags.map((t) => t.toLowerCase()), scheduledAt } });
  await logAction(ctx, "campaign.updated", "Campaign", c.id);
  return { ok: true };
});
