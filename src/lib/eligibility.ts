import type { AudioAsset, CallerId, Campaign, Purpose, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { inWindow, intersectWindow, startOfDayInTz } from "./time";

export const POLITICAL_HARD_WINDOW: [string, string] = ["09:00", "21:00"];

export type Check = { ok: true } | { ok: false; code: string; message: string; permanent: boolean };

const fail = (code: string, message: string, permanent = false): Check => ({ ok: false, code, message, permanent });
const OK: Check = { ok: true };

export async function platformStopped(): Promise<boolean> {
  const s = await prisma.platformSetting.findUnique({ where: { id: 1 } });
  return Boolean(s?.globalEmergencyStop);
}

/** Checks that apply to the whole campaign / call configuration (not per contact). */
export async function checkSetup(input: {
  tenant: Tenant;
  purpose: Purpose;
  callerId: CallerId;
  audio: AudioAsset;
  campaign?: Pick<Campaign, "windowStart" | "windowEnd" | "attested"> | null;
  now?: Date;
}): Promise<Check> {
  const { tenant, purpose, callerId, audio } = input;
  const now = input.now ?? new Date();
  if (tenant.status !== "ACTIVE") return fail("TENANT_SUSPENDED", "Organisation is suspended");
  if (tenant.emergencyStop || (await platformStopped())) return fail("EMERGENCY_STOP", "Emergency stop is active");
  if (!purpose.active) return fail("PURPOSE_INACTIVE", "Call purpose is disabled", true);
  if (callerId.tenantId !== tenant.id || callerId.verificationStatus !== "VERIFIED")
    return fail("CALLER_ID_UNVERIFIED", "Caller ID is not verified by the provider", true);
  if (callerId.providerKey !== tenant.providerKey) return fail("CALLER_ID_PROVIDER", "Caller ID belongs to a different provider", true);
  if (!callerId.approvedCategories.includes(purpose.category))
    return fail("CALLER_ID_PURPOSE", `Caller ID is not approved for ${purpose.category.toLowerCase()} calls`, true);
  if (audio.tenantId !== tenant.id || audio.approvalStatus !== "APPROVED") return fail("AUDIO_NOT_APPROVED", "Audio is not approved", true);
  if (purpose.category === "POLITICAL") {
    if (!tenant.politicalEnabled || !tenant.politicalProviderOk || !tenant.dltEntityId)
      return fail("POLITICAL_DISABLED", "Political calling is not enabled (needs DLT entity ID + provider approval in Settings)", true);
    if (!audio.forPolitical || !audio.mcmcCertificate) return fail("MCMC_MISSING", "Political audio needs an MCMC certificate number", true);
    if (input.campaign && !input.campaign.attested) return fail("NOT_ATTESTED", "Campaign consent attestation missing", true);
    const silence = await prisma.silencePeriod.findFirst({ where: { tenantId: tenant.id, startsAt: { lte: now }, endsAt: { gt: now } } });
    if (silence) return fail("SILENCE_PERIOD", `Election silence period: ${silence.label}`);
  }
  let win: [string, string] = [tenant.callWindowStart, tenant.callWindowEnd];
  if (input.campaign) win = intersectWindow(win, [input.campaign.windowStart, input.campaign.windowEnd]);
  if (purpose.category === "POLITICAL" || purpose.category === "PROMOTIONAL") win = intersectWindow(win, POLITICAL_HARD_WINDOW);
  if (!inWindow(now, win[0], win[1], tenant.timezone)) return fail("OUTSIDE_WINDOW", `Outside permitted calling hours (${win[0]}–${win[1]} IST)`);
  const today = startOfDayInTz(now, tenant.timezone);
  const tenantToday = await prisma.callAttempt.count({ where: { tenantId: tenant.id, createdAt: { gte: today }, status: { not: "CANCELLED" } } });
  if (tenantToday >= tenant.tenantDailyCap) return fail("TENANT_DAILY_CAP", "Organisation daily call cap reached");
  return OK;
}

export async function activeConsent(tenantId: string, contactId: string, purposeId: string, now = new Date()) {
  return prisma.consentRecord.findFirst({
    where: {
      tenantId,
      contactId,
      purposeId,
      revokedAt: null,
      grantedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { grantedAt: "desc" },
  });
}

/** Checks for one contact, evaluated at dispatch time. */
/** Cancelled attempts and transient technical failures do not count toward per-contact caps. */
const COUNTED = { status: { not: "CANCELLED" as const }, NOT: { status: "FAILED" as const, transient: true } };

export async function checkContact(input: { tenant: Tenant; contactId: string; purposeId: string; now?: Date }): Promise<Check> {
  const { tenant, contactId, purposeId } = input;
  const now = input.now ?? new Date();
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId: tenant.id } });
  if (!contact) return fail("CONTACT_MISSING", "Contact not found", true);
  const sup = await prisma.suppression.findUnique({ where: { tenantId_phoneHash: { tenantId: tenant.id, phoneHash: contact.phoneHash } } });
  if (sup) return fail("SUPPRESSED", "Number is on the do-not-call / opt-out list", true);
  const consent = await activeConsent(tenant.id, contactId, purposeId, now);
  if (!consent) return fail("NO_CONSENT", "No active consent for this purpose", true);
  const today = startOfDayInTz(now, tenant.timezone);
  const week = new Date(now.getTime() - 7 * 86400_000);
  const [d, w] = await Promise.all([
    prisma.callAttempt.count({ where: { tenantId: tenant.id, contactId, createdAt: { gte: today }, ...COUNTED } }),
    prisma.callAttempt.count({ where: { tenantId: tenant.id, contactId, createdAt: { gte: week }, ...COUNTED } }),
  ]);
  if (d >= tenant.contactDailyCap) return fail("CONTACT_DAILY_CAP", "Contact already called today");
  if (w >= tenant.contactWeeklyCap) return fail("CONTACT_WEEKLY_CAP", "Contact weekly call cap reached");
  return OK;
}
