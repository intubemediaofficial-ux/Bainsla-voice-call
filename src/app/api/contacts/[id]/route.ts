import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { decrypt } from "@/lib/crypto";
import { can } from "@/lib/rbac";

type P = { id: string };

/** Reveal full number (audited) — only for roles that can export. */
export const GET = route<P>("contacts.read", async ({ ctx, params }) => {
  if (!can(ctx.user.role, "contacts.export")) throw new ApiError(403, "Not allowed to view full numbers");
  const c = await prisma.contact.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  await logAction(ctx, "contact.revealed", "Contact", c.id);
  return { phone: decrypt(c.phoneEnc), name: decrypt(c.nameEnc) };
});

export const PATCH = route<P>("contacts.write", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ tags: z.array(z.string().max(40)).max(20) }));
  const c = await prisma.contact.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  await prisma.contact.update({ where: { id: c.id }, data: { tags: [...new Set(b.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))] } });
  await logAction(ctx, "contact.tags_updated", "Contact", c.id);
  return { ok: true };
});

/** Erasure request (DPDP): removes the contact's PII; call history keeps the masked number only. */
export const DELETE = route<P>("settings.manage", async ({ ctx, params }) => {
  const c = await prisma.contact.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  await prisma.$transaction([
    prisma.consentRecord.updateMany({ where: { contactId: c.id, revokedAt: null }, data: { revokedAt: new Date(), revokeNote: "Erasure request" } }),
    prisma.campaignRecipient.updateMany({ where: { contactId: c.id, status: { in: ["PENDING", "QUEUED"] } }, data: { status: "CANCELLED", skipReason: "ERASED" } }),
    prisma.contact.update({ where: { id: c.id }, data: { phoneEnc: "erased", nameEnc: null, tags: [] } }),
  ]);
  await logAction(ctx, "contact.erased", "Contact", c.id);
  return { ok: true };
});
