import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { IvrDef, validateIvr } from "@/lib/ivr";

export const POST = route("ivr.write", async ({ req, ctx }) => {
  const b = await body(req, z.object({ name: z.string().min(2).max(80), definition: IvrDef }));
  const err = validateIvr(b.definition);
  if (err) throw new ApiError(400, err);
  const f = await prisma.ivrFlow.create({ data: { tenantId: ctx.tenant.id, name: b.name, definition: b.definition, history: [], createdById: ctx.user.id } });
  await logAction(ctx, "ivr.created", "IvrFlow", f.id, { name: b.name });
  return f;
});
