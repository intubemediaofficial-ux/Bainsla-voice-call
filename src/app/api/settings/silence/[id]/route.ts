import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";

export const DELETE = route<{ id: string }>("settings.manage", async ({ ctx, params }) => {
  const s = await prisma.silencePeriod.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!s) throw new ApiError(404, "Not found");
  if (s.startsAt <= new Date() && s.endsAt > new Date()) throw new ApiError(400, "Cannot remove a silence period that is in effect");
  await prisma.silencePeriod.delete({ where: { id: s.id } });
  await logAction(ctx, "silence.removed", "SilencePeriod", s.id);
  return { ok: true };
});
