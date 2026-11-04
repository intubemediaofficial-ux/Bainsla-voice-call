import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { importRows } from "@/lib/importer";

const S = z.object({
  phone: z.string().min(6).max(30),
  name: z.string().max(120).optional().default(""),
  tags: z.string().max(200).optional().default(""),
  purposeId: z.string().min(1, "Choose a purpose"),
  source: z.string().min(3, "Consent source is required").max(200),
  evidence: z.string().min(2, "Consent evidence is required").max(200),
  grantedAt: z.string().min(8, "Consent date is required"),
});

export const POST = route("contacts.write", async ({ req, ctx }) => {
  const b = await body(req, S);
  const purpose = await prisma.purpose.findFirst({ where: { id: b.purposeId, tenantId: ctx.tenant.id } });
  if (!purpose) throw new ApiError(400, "Purpose not found");
  const r = await importRows([{ phone: b.phone, name: b.name, tags: b.tags, consent_source: b.source, consent_evidence: b.evidence, consent_date: b.grantedAt }], {
    tenant: ctx.tenant, actorId: ctx.user.id, purposeId: purpose.id, fileName: "(added manually)", tags: [], channel: "manual",
  });
  if (r.errors.length) throw new ApiError(400, r.errors[0].reason);
  await logAction(ctx, "contact.added", "ContactImport", r.importId, { purpose: purpose.name });
  return { ok: true, created: r.created, updated: r.updated };
});
