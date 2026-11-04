import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const POST = route<{ id: string }>("audio.approve", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ action: z.enum(["approve", "reject"]), reason: z.string().max(300).optional() }));
  const a = await prisma.audioAsset.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!a) throw new ApiError(404, "Not found");
  if (b.action === "approve") {
    if (a.forPolitical && !a.mcmcCertificate) throw new ApiError(400, "MCMC certificate number missing");
    await prisma.audioAsset.update({ where: { id: a.id }, data: { approvalStatus: "APPROVED", approvedById: ctx.user.id, approvedAt: new Date(), rejectReason: null } });
  } else {
    if (!b.reason) throw new ApiError(400, "Give a reason");
    const live = await prisma.campaign.count({ where: { audioAssetId: a.id, status: { in: ["RUNNING", "SCHEDULED", "PAUSED", "APPROVED"] } } });
    if (live) throw new ApiError(400, "Audio is used by an active campaign — cancel it first");
    await prisma.audioAsset.update({ where: { id: a.id }, data: { approvalStatus: "REJECTED", rejectReason: b.reason } });
  }
  await logAction(ctx, `audio.${b.action}d`, "AudioAsset", a.id, { reason: b.reason });
  return { ok: true };
});
