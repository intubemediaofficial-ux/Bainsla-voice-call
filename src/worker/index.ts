import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/db";
import { redis } from "../lib/redis";
import { CALLS_QUEUE, MOCK_QUEUE, QUEUE_PREFIX, enqueueCall } from "../lib/queue";
import { markSubmitExhausted, submitAttempt } from "../lib/dispatch";
import { checkContact, checkSetup, platformStopped } from "../lib/eligibility";
import { finalizeAttempt, INFLIGHT } from "../lib/callstate";
import { startRunning } from "../lib/campaign-actions";
import { signMockBody } from "../lib/provider/mock";
import { startOfDayInTz } from "../lib/time";

const TICK_MS = Number(process.env.WORKER_TICK_MS || 3000);
const internalBase = process.env.INTERNAL_APP_URL;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...a);

async function alert(tenantId: string, level: string, message: string, campaignId?: string) {
  await prisma.alert.create({ data: { tenantId, level, message, campaignId } });
}

async function promoteScheduled() {
  const due = await prisma.campaign.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } } });
  for (const c of due) {
    const n = await startRunning(c);
    log("campaign started", c.id, n);
  }
}

async function dispatchCampaign(campaignId: string) {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { tenant: true, purpose: true, callerId: true, audioAsset: true } });
  if (!c || c.status !== "RUNNING") return;
  const tenant = c.tenant;
  const inflight = await prisma.callAttempt.count({ where: { campaignId: c.id, status: { in: INFLIGHT } } });
  const open = await prisma.campaignRecipient.count({ where: { campaignId: c.id, status: { in: ["PENDING", "QUEUED", "IN_PROGRESS"] } } });
  if (open === 0 && inflight === 0) {
    await prisma.campaign.update({ where: { id: c.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    log("campaign completed", c.id);
    return;
  }
  const done = await prisma.callAttempt.groupBy({ by: ["status"], where: { campaignId: c.id, status: { notIn: [...INFLIGHT, "CANCELLED"] } }, _count: true });
  const total = done.reduce((s, d) => s + d._count, 0);
  const failed = done.filter((d) => d.status === "FAILED").reduce((s, d) => s + d._count, 0);
  if (total >= 20 && (failed * 100) / total > tenant.failureAutoPausePct) {
    await prisma.campaign.update({ where: { id: c.id }, data: { status: "PAUSED", pausedAt: new Date(), failureReason: `Auto-paused: ${Math.round((failed * 100) / total)}% of calls failed` } });
    await alert(tenant.id, "critical", `Campaign "${c.name}" auto-paused — failure rate above ${tenant.failureAutoPausePct}%`, c.id);
    return;
  }
  const setup = await checkSetup({ tenant, purpose: c.purpose, callerId: c.callerId, audio: c.audioAsset, campaign: c });
  if (!setup.ok) {
    if (setup.permanent) {
      await prisma.campaign.update({ where: { id: c.id }, data: { status: "PAUSED", pausedAt: new Date(), failureReason: setup.message } });
      await alert(tenant.id, "warning", `Campaign "${c.name}" paused: ${setup.message}`, c.id);
    }
    return;
  }
  const today = startOfDayInTz(new Date(), tenant.timezone);
  const usedToday = await prisma.callAttempt.count({ where: { campaignId: c.id, createdAt: { gte: today }, status: { not: "CANCELLED" } } });
  const tenantToday = await prisma.callAttempt.count({ where: { tenantId: tenant.id, createdAt: { gte: today }, status: { not: "CANCELLED" } } });
  const slots = Math.min(c.concurrency - inflight, c.dailyCap - usedToday, tenant.tenantDailyCap - tenantToday, 50);
  if (slots <= 0) return;
  const recs = await prisma.campaignRecipient.findMany({ where: { campaignId: c.id, status: "PENDING", nextAttemptAt: { lte: new Date() } }, take: slots, orderBy: { nextAttemptAt: "asc" } });
  for (const r of recs) {
    const claimed = await prisma.campaignRecipient.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "QUEUED", attempts: { increment: 1 }, eligibilityCheckedAt: new Date() } });
    if (claimed.count !== 1) continue;
    const chk = await checkContact({ tenant, contactId: r.contactId, purposeId: c.purposeId });
    if (!chk.ok) {
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: chk.permanent ? { status: "SKIPPED", skipReason: chk.code } : { status: "PENDING", attempts: { decrement: 1 }, nextAttemptAt: new Date(Date.now() + 3600_000), skipReason: chk.code },
      });
      continue;
    }
    const attemptNo = r.attempts + 1;
    const a = await prisma.callAttempt.create({
      data: {
        tenantId: tenant.id, campaignId: c.id, recipientId: r.id, contactId: r.contactId, callerIdId: c.callerIdId, audioAssetId: c.audioAssetId,
        purposeId: c.purposeId, idempotencyKey: `camp:${c.id}:${r.id}:${attemptNo}`, providerKey: tenant.providerKey, attemptNo,
      },
    });
    await enqueueCall(a.id);
  }
}

async function reapStale() {
  const cutoff = new Date(Date.now() - 20 * 60_000);
  const stale = await prisma.callAttempt.findMany({ where: { status: { in: ["SUBMITTED", "RINGING", "IN_PROGRESS"] }, updatedAt: { lt: cutoff } }, take: 200 });
  for (const s of stale) {
    const u = await prisma.callAttempt.update({ where: { id: s.id }, data: { status: "FAILED", transient: true, failureReason: "No final status from provider", endedAt: new Date() } });
    await finalizeAttempt(u);
  }
  const qcut = new Date(Date.now() - 30 * 60_000);
  const lost = await prisma.callAttempt.findMany({ where: { status: "QUEUED", updatedAt: { lt: qcut } }, take: 200, select: { id: true } });
  for (const l of lost) await enqueueCall(l.id).catch(() => {});
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await redis().set("bvoice:worker:heartbeat", String(Date.now()), "EX", 120);
    const lock = await redis().set("bvoice:tick-lock", String(process.pid), "PX", TICK_MS * 3, "NX");
    if (!lock) return;
    try {
      if (await platformStopped()) return;
      await promoteScheduled();
      const running = await prisma.campaign.findMany({ where: { status: "RUNNING", tenant: { emergencyStop: false, status: "ACTIVE" } }, select: { id: true } });
      for (const r of running) await dispatchCampaign(r.id).catch((e) => log("dispatch error", r.id, e));
      await reapStale();
    } finally {
      await redis().del("bvoice:tick-lock");
    }
  } catch (e) {
    log("tick error", e);
  } finally {
    ticking = false;
  }
}

const connection = redis();

const callWorker = new Worker(
  CALLS_QUEUE,
  async (job: Job<{ attemptId: string }>) => submitAttempt(job.data.attemptId),
  { connection, prefix: QUEUE_PREFIX, concurrency: 10, limiter: { max: Number(process.env.PROVIDER_CPS || 10), duration: 1000 } },
);
callWorker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) await markSubmitExhausted(job.data.attemptId, err.message).catch(() => {});
});

const mockWorker = new Worker(
  MOCK_QUEUE,
  async (job: Job<{ url: string; event: unknown }>) => {
    let url = job.data.url;
    if (internalBase) {
      const u = new URL(url);
      url = internalBase.replace(/\/$/, "") + u.pathname + u.search;
    }
    const body = JSON.stringify(job.data.event);
    const { ts, sig } = signMockBody(body);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-bv-timestamp": ts, "x-bv-signature": sig }, body });
    if (!res.ok && res.status >= 500) throw new Error(`webhook ${res.status}`);
    return res.status;
  },
  { connection, prefix: QUEUE_PREFIX, concurrency: 20 },
);

const timer = setInterval(tick, TICK_MS);
log("started", { tick: TICK_MS });

async function shutdown() {
  clearInterval(timer);
  await Promise.allSettled([callWorker.close(), mockWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
