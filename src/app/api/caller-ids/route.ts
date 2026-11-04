import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";

/** Request a caller ID. It stays PENDING until it is found on the provider account by "Sync from provider". */
export const POST = route("callerids.request", async ({ req, ctx }) => {
  const b = await body(req, z.object({ phone: z.string().min(6).max(30), label: z.string().min(2).max(60), notes: z.string().max(300).optional() }));
  const p = normalizePhone(b.phone);
  if (!p.ok) throw new ApiError(400, p.error);
  const c = await prisma.callerId.create({
    data: { tenantId: ctx.tenant.id, phoneE164: p.e164, label: b.label, providerKey: ctx.tenant.providerKey, notes: b.notes, requestedById: ctx.user.id },
  });
  await logAction(ctx, "callerid.requested", "CallerId", c.id, { label: c.label });
  return c;
});
