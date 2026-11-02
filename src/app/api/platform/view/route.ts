import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const POST = route(null, async ({ req, ctx }) => {
  if (!ctx.user.isPlatformAdmin) throw new ApiError(403, "Platform admin only");
  const b = await body(req, z.object({ tenantId: z.string() }));
  const t = await prisma.tenant.findUnique({ where: { id: b.tenantId } });
  if (!t) throw new ApiError(404, "Not found");
  await prisma.session.update({ where: { id: ctx.sessionId }, data: { tenantView: t.id === ctx.user.tenantId ? null : t.id } });
  await logAction(ctx, "platform.switch_tenant", "Tenant", t.id);
  return { ok: true };
});
