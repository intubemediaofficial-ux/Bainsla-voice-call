import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { IvrDef, validateIvr } from "@/lib/ivr";

export const PATCH = route<{ id: string }>("ivr.write", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ name: z.string().min(2).max(80), definition: IvrDef }));
  const err = validateIvr(b.definition);
  if (err) throw new ApiError(400, err);
  const f = await prisma.ivrFlow.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!f) throw new ApiError(404, "Not found");
  const history = [...((f.history as unknown[]) ?? []), { version: f.version, definition: f.definition, at: new Date().toISOString() }].slice(-20);
  await prisma.ivrFlow.update({ where: { id: f.id }, data: { name: b.name, definition: b.definition, version: f.version + 1, history: history as Prisma.InputJsonValue } });
  await logAction(ctx, "ivr.updated", "IvrFlow", f.id, { version: f.version + 1 });
  return { ok: true };
});
