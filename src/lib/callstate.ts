import type { CallAttempt, CallStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { audit } from "./audit";
import type { ParsedWebhook } from "./provider/types";

const RANK: Record<CallStatus, number> = {
  QUEUED: 0,
  SUBMITTED: 1,
  RINGING: 2,
  IN_PROGRESS: 3,
  COMPLETED: 9,
  NO_ANSWER: 9,
  BUSY: 9,
  FAILED: 9,
  REJECTED: 9,
  CANCELLED: 9,
};

export const TERMINAL: CallStatus[] = ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "REJECTED", "CANCELLED"];
export const INFLIGHT: CallStatus[] = ["QUEUED", "SUBMITTED", "RINGING", "IN_PROGRESS"];

export function isTerminal(s: CallStatus) {
  return RANK[s] === 9;
}

export async function optOutPhoneHash(tenantId: string, phoneHash: string, phoneMasked: string, reason: "OPT_OUT_IVR" | "OPT_OUT_WEB" | "MANUAL", note?: string, actorId?: string | null) {
  await prisma.suppression.upsert({
    where: { tenantId_phoneHash: { tenantId, phoneHash } },
    create: { tenantId, phoneHash, phoneMasked, reason, note, createdById: actorId ?? null },
    update: {},
  });
  const contacts = await prisma.contact.findMany({ where: { tenantId, phoneHash }, select: { id: true } });
  if (contacts.length) {
    await prisma.campaignRecipient.updateMany({
      where: { contactId: { in: contacts.map((c) => c.id) }, status: { in: ["PENDING", "QUEUED"] } },
      data: { status: "SKIPPED", skipReason: "SUPPRESSED" },
    });
  }
}

/** Record keys pressed during a call; key 9 opts the number out of all future calls. */
export async function recordDtmf(attempt: CallAttempt, raw: string): Promise<CallAttempt> {
  const digits = raw.replace(/[^0-9*#]/g, "").slice(0, 20);
  if (!digits) return attempt;
  const optOut = digits.includes("9");
  const updated = await prisma.callAttempt.update({ where: { id: attempt.id }, data: { dtmf: digits, ...(optOut ? { optedOut: true } : {}) } });
  if (optOut && !attempt.optedOut) {
    const c = await prisma.contact.findUnique({ where: { id: attempt.contactId } });
    if (c) {
      await optOutPhoneHash(attempt.tenantId, c.phoneHash, c.phoneMasked, "OPT_OUT_IVR", "Pressed 9 during call");
      await audit({ tenantId: attempt.tenantId }, "contact.opt_out", "Contact", c.id, { via: "ivr", attemptId: attempt.id });
    }
  }
  return updated;
}

/** Apply a verified provider event. Idempotent (dedupe by provider event id) and order-safe (status never regresses). */
export async function applyProviderEvent(providerKey: string, ev: ParsedWebhook): Promise<"applied" | "duplicate" | "unknown_call" | "stale"> {
  const attempt = await prisma.callAttempt.findUnique({ where: { providerCallId: ev.providerCallId } });
  if (!attempt || attempt.providerKey !== providerKey) return "unknown_call";
  try {
    await prisma.callEvent.create({
      data: {
        callAttemptId: attempt.id,
        providerEventId: `${providerKey}:${ev.eventId}`,
        type: ev.status,
        payloadRedacted: ev.redacted as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return "duplicate";
    throw e;
  }
  if (ev.dtmf) Object.assign(attempt, await recordDtmf(attempt, ev.dtmf));
  if (RANK[ev.status] <= RANK[attempt.status] || isTerminal(attempt.status)) return "stale";
  const now = new Date();
  const data: Prisma.CallAttemptUpdateInput = { status: ev.status };
  if (ev.status === "IN_PROGRESS") data.answeredAt = now;
  if (isTerminal(ev.status)) {
    data.endedAt = now;
    data.durationSeconds = Math.max(0, Math.round(ev.durationSeconds ?? 0));
    data.failureReason = ev.reason ?? null;
    data.transient = Boolean(ev.transient);
    if (ev.status === "COMPLETED" && !attempt.answeredAt) data.answeredAt = now;
  }
  const updated = await prisma.callAttempt.update({ where: { id: attempt.id }, data });
  if (isTerminal(ev.status)) await finalizeAttempt(updated);
  return "applied";
}

export async function finalizeAttempt(attempt: CallAttempt) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: attempt.tenantId } });
  const cost = attempt.status === "COMPLETED" ? Math.ceil(Math.max(1, attempt.durationSeconds) / 60) * tenant.ratePerMinutePaise : 0;
  await prisma.callAttempt.update({ where: { id: attempt.id }, data: { costPaise: cost } });
  if (!attempt.recipientId) return;
  const rec = await prisma.campaignRecipient.findUnique({ where: { id: attempt.recipientId } });
  if (!rec || rec.status === "SKIPPED" || rec.status === "CANCELLED") return;
  const opted = attempt.optedOut || (attempt.dtmf ?? "").includes("9");
  let status: "COMPLETED" | "FAILED" | "PENDING" = "FAILED";
  let next = new Date();
  if (attempt.status === "COMPLETED" || opted) status = "COMPLETED";
  else {
    const retryable =
      (attempt.status === "FAILED" && attempt.transient) || ((attempt.status === "NO_ANSWER" || attempt.status === "BUSY") && tenant.retryNoAnswer);
    if (retryable && rec.attempts <= tenant.maxRetries) {
      status = "PENDING";
      next = new Date(Date.now() + tenant.retryBackoffSec * 1000 * 2 ** Math.max(0, rec.attempts - 1));
    }
  }
  await prisma.campaignRecipient.update({
    where: { id: rec.id },
    data: { status, nextAttemptAt: next, skipReason: status === "FAILED" ? attempt.failureReason ?? attempt.status : null },
  });
}
