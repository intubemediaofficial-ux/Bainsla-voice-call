import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { fromLocalInput } from "@/lib/time";

export const POST = route("settings.manage", async ({ req, ctx }) => {
  const b = await body(req, z.object({ label: z.string().min(3).max(100), startsAt: z.string(), endsAt: z.string() }));
  const s = fromLocalInput(b.startsAt);
  const e = fromLocalInput(b.endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) throw new ApiError(400, "End must be after start");
  const p = await prisma.silencePeriod.create({ data: { tenantId: ctx.tenant.id, label: b.label, startsAt: s, endsAt: e } });
  await logAction(ctx, "silence.added", "SilencePeriod", p.id, { label: b.label });
  return p;
});
