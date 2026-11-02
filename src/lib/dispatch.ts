import type { CallAttempt } from "@prisma/client";
import { prisma } from "./db";
import { decrypt, signValue } from "./crypto";
import { env } from "./env";
import { enqueueCall } from "./queue";
import { getProvider } from "./provider";
import { ProviderError } from "./provider/types";
import { finalizeAttempt } from "./callstate";
import { checkContact, checkSetup, platformStopped } from "./eligibility";

export function signedAudioUrl(audioId: string, ttlSec = 6 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = signValue(`audio:${audioId}:${exp}`);
  return `${env.appUrl}/api/audio/${audioId}/stream?exp=${exp}&sig=${sig}`;
}

export function statusCallbackUrl(providerKey: string) {
  const base = `${env.appUrl}/api/webhooks/telephony/${providerKey}`;
  return providerKey === "exotel" ? `${base}?t=${encodeURIComponent(process.env.EXOTEL_WEBHOOK_TOKEN || "")}` : base;
}

export class DispatchError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Single (non-campaign) call: full eligibility check, idempotent creation, enqueue. */
export async function createSingleCall(input: {
  tenantId: string;
  contactId: string;
  purposeId: string;
  callerIdId: string;
  audioAssetId: string;
  idempotencyKey: string;
  actorId: string;
}): Promise<{ attempt: CallAttempt; replay: boolean }> {
  const key = `single:${input.tenantId}:${input.idempotencyKey}`;
  const existing = await prisma.callAttempt.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { attempt: existing, replay: true };
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const [purpose, callerId, audio] = await Promise.all([
    prisma.purpose.findFirst({ where: { id: input.purposeId, tenantId: tenant.id } }),
    prisma.callerId.findFirst({ where: { id: input.callerIdId, tenantId: tenant.id } }),
    prisma.audioAsset.findFirst({ where: { id: input.audioAssetId, tenantId: tenant.id } }),
  ]);
  if (!purpose || !callerId || !audio) throw new DispatchError("NOT_FOUND", "Purpose, caller ID or audio not found");
  if (purpose.category === "POLITICAL") throw new DispatchError("POLITICAL_SINGLE", "Political calls can only be sent as an approved campaign");
  const setup = await checkSetup({ tenant, purpose, callerId, audio });
  if (!setup.ok) throw new DispatchError(setup.code, setup.message);
  const c = await checkContact({ tenant, contactId: input.contactId, purposeId: purpose.id });
  if (!c.ok) throw new DispatchError(c.code, c.message);
  try {
    const attempt = await prisma.callAttempt.create({
      data: {
        tenantId: tenant.id,
        contactId: input.contactId,
        callerIdId: callerId.id,
        audioAssetId: audio.id,
        purposeId: purpose.id,
        idempotencyKey: key,
        providerKey: tenant.providerKey,
        createdById: input.actorId,
      },
    });
    await enqueueCall(attempt.id);
    return { attempt, replay: false };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { attempt: await prisma.callAttempt.findUniqueOrThrow({ where: { idempotencyKey: key } }), replay: true };
    }
    throw e;
  }
}

/** Worker side: submit a queued attempt to the provider after a last-moment safety re-check. */
export async function submitAttempt(attemptId: string): Promise<string> {
  const a = await prisma.callAttempt.findUnique({
    where: { id: attemptId },
    include: { contact: true, callerId: true, audioAsset: true, campaign: true, tenant: true },
  });
  if (!a) return "missing";
  if (a.status !== "QUEUED") return "not-queued";
  const cancel = async (reason: string, backToPending: boolean) => {
    await prisma.callAttempt.update({ where: { id: a.id }, data: { status: "CANCELLED", failureReason: reason, endedAt: new Date() } });
    if (a.recipientId) {
      await prisma.campaignRecipient.update({
        where: { id: a.recipientId },
        data: backToPending ? { status: "PENDING", attempts: { decrement: 1 } } : { status: "CANCELLED", skipReason: reason },
      });
    }
    return `cancelled:${reason}`;
  };
  if (a.tenant.emergencyStop || (await platformStopped())) return cancel("EMERGENCY_STOP", true);
  if (a.campaign && a.campaign.status === "PAUSED") return cancel("PAUSED", true);
  if (a.campaign && a.campaign.status !== "RUNNING") return cancel(`CAMPAIGN_${a.campaign.status}`, false);
  if (a.callerId.verificationStatus !== "VERIFIED" || a.audioAsset.approvalStatus !== "APPROVED") return cancel("SETUP_INVALID", false);
  const sup = await prisma.suppression.findUnique({ where: { tenantId_phoneHash: { tenantId: a.tenantId, phoneHash: a.contact.phoneHash } } });
  if (sup) return cancel("SUPPRESSED", false);

  const provider = getProvider(a.providerKey);
  try {
    const r = await provider.createVoiceCall({
      to: decrypt(a.contact.phoneEnc),
      verifiedCallerId: a.callerId.phoneE164,
      approvedAudioUrl: signedAudioUrl(a.audioAssetId),
      audioDurationSeconds: a.audioAsset.durationSeconds,
      idempotencyKey: a.idempotencyKey,
      statusCallbackUrl: statusCallbackUrl(a.providerKey),
      attemptId: a.id,
    });
    await prisma.callAttempt.update({ where: { id: a.id }, data: { providerCallId: r.providerCallId, status: "SUBMITTED", submittedAt: new Date() } });
    if (a.recipientId) await prisma.campaignRecipient.update({ where: { id: a.recipientId }, data: { status: "IN_PROGRESS" } });
    return "submitted";
  } catch (e) {
    if (e instanceof ProviderError && e.transient) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.callAttempt.update({
      where: { id: a.id },
      data: { status: "FAILED", failureReason: msg.slice(0, 300), transient: false, endedAt: new Date() },
    });
    await finalizeAttempt(updated);
    return "failed";
  }
}

/** Called when BullMQ gives up retrying a transient provider error. */
export async function markSubmitExhausted(attemptId: string, message: string) {
  const a = await prisma.callAttempt.findUnique({ where: { id: attemptId } });
  if (!a || a.status !== "QUEUED") return;
  const updated = await prisma.callAttempt.update({
    where: { id: a.id },
    data: { status: "FAILED", failureReason: `Provider unavailable: ${message}`.slice(0, 300), transient: true, endedAt: new Date() },
  });
  await finalizeAttempt(updated);
}
