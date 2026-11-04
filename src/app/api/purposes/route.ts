import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const S = z.object({
  name: z.string().min(3).max(80),
  category: z.enum(["TRANSACTIONAL", "SERVICE", "PROMOTIONAL", "POLITICAL"]),
  description: z.string().max(300).optional(),
});

export const POST = route("settings.manage", async ({ req, ctx }) => {
  const b = await body(req, S);
  if (b.category === "POLITICAL" && !ctx.tenant.politicalEnabled) throw new ApiError(400, "Enable political calling in Settings first");
  const p = await prisma.purpose.create({ data: { tenantId: ctx.tenant.id, ...b } });
  await logAction(ctx, "purpose.created", "Purpose", p.id, { name: p.name, category: p.category });
  return p;
});
