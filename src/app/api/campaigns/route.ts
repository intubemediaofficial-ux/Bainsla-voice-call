import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, hhmm, logAction, route } from "@/lib/api";
import { fromLocalInput } from "@/lib/time";

export const CampaignInput = z.object({
  name: z.string().min(3, "Name is too short").max(100),
  purposeId: z.string().min(1, "Choose a purpose"),
  audioAssetId: z.string().min(1, "Choose an audio"),
  callerIdId: z.string().min(1, "Choose a caller ID"),
  ivrFlowId: z.string().optional().nullable(),
  segmentTags: z.array(z.string().max(40)).max(20).default([]),
  scheduledAt: z.string().optional().nullable(),
  windowStart: hhmm,
  windowEnd: hhmm,
  dailyCap: z.number().int().min(1).max(1_000_000),
  concurrency: z.number().int().min(1).max(200),
  consentBasis: z.string().min(6, "Describe how these people gave consent").max(500),
  optOutMethod: z.string().min(6, "Explain how people can opt out").max(300),
  attested: z.boolean().default(false),
});

export async function checkRefs(tenantId: string, b: z.infer<typeof CampaignInput>) {
  const [p, a, c, i] = await Promise.all([
    prisma.purpose.findFirst({ where: { id: b.purposeId, tenantId } }),
    prisma.audioAsset.findFirst({ where: { id: b.audioAssetId, tenantId } }),
    prisma.callerId.findFirst({ where: { id: b.callerIdId, tenantId } }),
    b.ivrFlowId ? prisma.ivrFlow.findFirst({ where: { id: b.ivrFlowId, tenantId } }) : Promise.resolve(true),
  ]);
  if (!p || !a || !c || !i) throw new ApiError(400, "Purpose, audio, caller ID or IVR not found");
  if (b.windowStart >= b.windowEnd) throw new ApiError(400, "Calling window end must be after start");
  const scheduledAt = b.scheduledAt ? fromLocalInput(b.scheduledAt) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, "Schedule time is invalid");
  return { purpose: p, scheduledAt };
}

export const POST = route("campaigns.write", async ({ req, ctx }) => {
  const b = await body(req, CampaignInput);
  const { scheduledAt } = await checkRefs(ctx.tenant.id, b);
  const c = await prisma.campaign.create({
    data: { ...b, ivrFlowId: b.ivrFlowId || null, segmentTags: b.segmentTags.map((t) => t.toLowerCase()), scheduledAt, tenantId: ctx.tenant.id, createdById: ctx.user.id },
  });
  await logAction(ctx, "campaign.created", "Campaign", c.id, { name: c.name });
  return c;
});
