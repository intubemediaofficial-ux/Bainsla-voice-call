import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";

/** Only manually added entries can be removed. A person's own opt-out can never be undone by staff. */
export const DELETE = route<{ id: string }>("settings.manage", async ({ ctx, params }) => {
  const s = await prisma.suppression.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!s) throw new ApiError(404, "Not found");
  if (s.reason !== "MANUAL") throw new ApiError(400, "Opt-outs made by the person themselves cannot be removed");
  await prisma.suppression.delete({ where: { id: s.id } });
  await logAction(ctx, "suppression.removed", "Suppression", s.id);
  return { ok: true };
});
