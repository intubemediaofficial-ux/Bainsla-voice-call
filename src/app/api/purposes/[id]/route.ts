import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const PATCH = route<{ id: string }>("settings.manage", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ active: z.boolean().optional(), description: z.string().max(300).optional() }));
  const p = await prisma.purpose.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!p) throw new ApiError(404, "Not found");
  await prisma.purpose.update({ where: { id: p.id }, data: b });
  await logAction(ctx, "purpose.updated", "Purpose", p.id, b);
  return { ok: true };
});
