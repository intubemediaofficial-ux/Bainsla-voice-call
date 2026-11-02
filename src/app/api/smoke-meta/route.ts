import { prisma } from "@/lib/db";
import { route } from "@/lib/api";

/** Lightweight lookup used by the UI pickers and the smoke test (no PII). */
export const GET = route("campaigns.read", async ({ req, ctx }) => {
  const tag = new URL(req.url).searchParams.get("tag");
  const [purposes, callerIds] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, name: true, category: true, active: true } }),
    prisma.callerId.findMany({ where: { tenantId: ctx.tenant.id }, select: { id: true, phoneE164: true, verificationStatus: true, approvedCategories: true } }),
  ]);
  let suppressedInTag = 0;
  let contactInTag: string | null = null;
  if (tag) {
    const cs = await prisma.contact.findMany({ where: { tenantId: ctx.tenant.id, tags: { has: tag } }, select: { id: true, phoneHash: true } });
    suppressedInTag = await prisma.suppression.count({ where: { tenantId: ctx.tenant.id, phoneHash: { in: cs.map((c) => c.phoneHash) } } });
    contactInTag = cs[0]?.id ?? null;
  }
  return { purposes, callerIds, suppressedInTag, contactInTag };
});
