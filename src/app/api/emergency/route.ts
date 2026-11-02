import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, logAction, route } from "@/lib/api";

/** Emergency stop: blocks every new dispatch for this organisation and pauses running campaigns. */
export const POST = route("emergency.stop", async ({ req, ctx }) => {
  const b = await body(req, z.object({ on: z.boolean() }));
  await prisma.tenant.update({ where: { id: ctx.tenant.id }, data: { emergencyStop: b.on } });
  let paused = 0;
  if (b.on) {
    paused = (await prisma.campaign.updateMany({ where: { tenantId: ctx.tenant.id, status: { in: ["RUNNING", "SCHEDULED"] } }, data: { status: "PAUSED", pausedAt: new Date() } })).count;
    await prisma.callAttempt.updateMany({ where: { tenantId: ctx.tenant.id, status: "QUEUED" }, data: { status: "CANCELLED", failureReason: "EMERGENCY_STOP", endedAt: new Date() } });
    await prisma.campaignRecipient.updateMany({ where: { campaign: { tenantId: ctx.tenant.id }, status: "QUEUED" }, data: { status: "PENDING" } });
  }
  await logAction(ctx, b.on ? "emergency.stop_on" : "emergency.stop_off", "Tenant", ctx.tenant.id, { paused });
  return { ok: true, paused };
});
