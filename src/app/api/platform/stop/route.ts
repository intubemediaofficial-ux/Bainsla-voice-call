import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const POST = route(null, async ({ req, ctx }) => {
  if (!ctx.user.isPlatformAdmin) throw new ApiError(403, "Platform admin only");
  const b = await body(req, z.object({ on: z.boolean() }));
  await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1, globalEmergencyStop: b.on }, update: { globalEmergencyStop: b.on } });
  if (b.on) await prisma.callAttempt.updateMany({ where: { status: "QUEUED" }, data: { status: "CANCELLED", failureReason: "EMERGENCY_STOP", endedAt: new Date() } });
  await logAction(ctx, b.on ? "platform.stop_on" : "platform.stop_off", "PlatformSetting", "1");
  return { ok: true };
});
