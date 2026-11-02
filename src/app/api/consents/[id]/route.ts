import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";

export const POST = route<{ id: string }>("contacts.write", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ note: z.string().max(200).optional() }));
  const c = await prisma.consentRecord.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id, revokedAt: null } });
  if (!c) throw new ApiError(404, "Active consent not found");
  await prisma.consentRecord.update({ where: { id: c.id }, data: { revokedAt: new Date(), revokeNote: b.note || "Revoked by staff" } });
  await prisma.campaignRecipient.updateMany({
    where: { contactId: c.contactId, status: { in: ["PENDING", "QUEUED"] }, campaign: { purposeId: c.purposeId } },
    data: { status: "SKIPPED", skipReason: "CONSENT_REVOKED" },
  });
  await logAction(ctx, "consent.revoked", "ConsentRecord", c.id);
  return { ok: true };
});
