import type { Campaign, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { checkSetup } from "./eligibility";

export type ValidationItem = { key: string; label: string; ok: boolean; detail: string };

/** Contacts in the segment that have active consent for the purpose and are not suppressed. */
export function eligibleContactWhere(tenantId: string, purposeId: string, tags: string[], now = new Date()): Prisma.ContactWhereInput {
  return {
    tenantId,
    ...(tags.length ? { tags: { hasSome: tags } } : {}),
    consents: {
      some: { purposeId, revokedAt: null, grantedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    },
  };
}

export async function countAudience(tenantId: string, purposeId: string, tags: string[]) {
  const where = eligibleContactWhere(tenantId, purposeId, tags);
  const [segment, withConsent, suppressed] = await Promise.all([
    prisma.contact.count({ where: { tenantId, ...(tags.length ? { tags: { hasSome: tags } } : {}) } }),
    prisma.contact.count({ where }),
    prisma.contact.count({
      where: {
        ...where,
        phoneHash: { in: (await prisma.suppression.findMany({ where: { tenantId }, select: { phoneHash: true } })).map((s) => s.phoneHash) },
      },
    }),
  ]);
  return { segment, withConsent, suppressed, eligible: withConsent - suppressed };
}

export async function validateCampaign(c: Campaign): Promise<{ ok: boolean; items: ValidationItem[]; audience: number; costPaise: number }> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
  const [purpose, callerId, audio] = await Promise.all([
    prisma.purpose.findUniqueOrThrow({ where: { id: c.purposeId } }),
    prisma.callerId.findUniqueOrThrow({ where: { id: c.callerIdId } }),
    prisma.audioAsset.findUniqueOrThrow({ where: { id: c.audioAssetId } }),
  ]);
  const aud = await countAudience(c.tenantId, c.purposeId, c.segmentTags);
  const mins = Math.max(1, Math.ceil(audio.durationSeconds / 60));
  const costPaise = aud.eligible * mins * tenant.ratePerMinutePaise;
  const items: ValidationItem[] = [];
  const push = (key: string, label: string, ok: boolean, detail: string) => items.push({ key, label, ok, detail });
  push("caller", "Verified caller ID", callerId.verificationStatus === "VERIFIED" && callerId.approvedCategories.includes(purpose.category) && callerId.providerKey === tenant.providerKey,
    `${callerId.phoneE164} — ${callerId.verificationStatus.toLowerCase()}, approved for ${callerId.approvedCategories.join(", ").toLowerCase() || "nothing yet"}`);
  push("audio", "Approved audio", audio.approvalStatus === "APPROVED", `${audio.name} v${audio.version} — ${audio.approvalStatus.toLowerCase()}`);
  push("audience", "Consented audience", aud.eligible > 0, `${aud.eligible} eligible of ${aud.segment} in segment (${aud.segment - aud.withConsent} without consent, ${aud.suppressed} opted out)`);
  push("window", "Calling window", c.windowStart < c.windowEnd, `${c.windowStart}–${c.windowEnd} IST (organisation: ${tenant.callWindowStart}–${tenant.callWindowEnd})`);
  push("optout", "Opt-out instructions", c.optOutMethod.trim().length > 5, c.optOutMethod);
  push("consent", "Consent basis recorded", c.consentBasis.trim().length > 5, c.consentBasis);
  if (purpose.category === "POLITICAL") {
    push("political", "Political calling enabled", tenant.politicalEnabled && tenant.politicalProviderOk && Boolean(tenant.dltEntityId),
      tenant.politicalEnabled ? `DLT entity ${tenant.dltEntityId || "missing"}, provider approval ${tenant.politicalProviderOk ? "confirmed" : "missing"}` : "Disabled in Settings");
    push("mcmc", "MCMC certificate on audio", audio.forPolitical && Boolean(audio.mcmcCertificate), audio.mcmcCertificate || "Missing");
    push("attest", "Consent attestation", c.attested, c.attested ? "Confirmed by creator" : "Not confirmed");
  }
  const setup = await checkSetup({ tenant, purpose, callerId, audio, campaign: { ...c, windowStart: "00:00", windowEnd: "23:59" } });
  if (!setup.ok && setup.permanent) push("setup", "Safety checks", false, setup.message);
  if (!setup.ok && (setup.code === "EMERGENCY_STOP" || setup.code === "TENANT_SUSPENDED")) push("stop", "Calling allowed", false, setup.message);
  return { ok: items.every((i) => i.ok), items, audience: aud.eligible, costPaise };
}

/** Snapshot eligible recipients when a campaign starts. Consent and suppression are re-checked at dispatch. */
export async function materializeRecipients(c: Campaign) {
  const where = eligibleContactWhere(c.tenantId, c.purposeId, c.segmentTags);
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const batch = await prisma.contact.findMany({ where, select: { id: true }, take: 2000, orderBy: { id: "asc" }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
    if (!batch.length) break;
    const r = await prisma.campaignRecipient.createMany({ data: batch.map((b) => ({ campaignId: c.id, contactId: b.id })), skipDuplicates: true });
    total += r.count;
    cursor = batch[batch.length - 1].id;
  }
  return total;
}

export const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  APPROVED: "bg-sky-50 text-sky-800 ring-sky-200",
  SCHEDULED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  RUNNING: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PAUSED: "bg-orange-50 text-orange-800 ring-orange-200",
  COMPLETED: "bg-violet-50 text-violet-800 ring-violet-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  FAILED: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  NEEDS_REVIEW: "Needs review",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  RUNNING: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};
