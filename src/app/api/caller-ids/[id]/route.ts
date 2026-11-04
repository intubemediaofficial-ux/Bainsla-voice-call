import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const PATCH = route<{ id: string }>("callerids.manage", async ({ req, ctx, params }) => {
  const b = await body(
    req,
    z.object({
      label: z.string().min(2).max(60).optional(),
      approvedCategories: z.array(z.enum(["TRANSACTIONAL", "SERVICE", "PROMOTIONAL", "POLITICAL"])).optional(),
      action: z.enum(["reject", "revoke"]).optional(),
    }),
  );
  const c = await prisma.callerId.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  if (b.approvedCategories?.includes("POLITICAL") && !(ctx.tenant.politicalEnabled && ctx.tenant.politicalProviderOk))
    throw new ApiError(400, "Political approval for this caller ID needs political calling enabled with provider approval in Settings");
  await prisma.callerId.update({
    where: { id: c.id },
    data: {
      ...(b.label ? { label: b.label } : {}),
      ...(b.approvedCategories ? { approvedCategories: b.approvedCategories } : {}),
      ...(b.action === "reject" ? { verificationStatus: "REJECTED" } : b.action === "revoke" ? { verificationStatus: "REVOKED" } : {}),
    },
  });
  await logAction(ctx, "callerid.updated", "CallerId", c.id, { label: b.label, categories: b.approvedCategories, action: b.action });
  return { ok: true };
});
