import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, hhmm, logAction, route } from "@/lib/api";
import { availableProviders } from "@/lib/provider";

const S = z.object({
  name: z.string().min(2).max(100),
  callWindowStart: hhmm,
  callWindowEnd: hhmm,
  tenantDailyCap: z.number().int().min(1).max(5_000_000),
  contactDailyCap: z.number().int().min(1).max(10),
  contactWeeklyCap: z.number().int().min(1).max(30),
  defaultConcurrency: z.number().int().min(1).max(200),
  secondApprovalAbove: z.number().int().min(0).max(10_000_000),
  maxRetries: z.number().int().min(0).max(5),
  retryBackoffSec: z.number().int().min(60).max(86400),
  retryNoAnswer: z.boolean(),
  failureAutoPausePct: z.number().int().min(5).max(100),
  retentionDays: z.number().int().min(0).max(3650),
  requireMfa: z.boolean(),
  providerKey: z.string(),
  politicalEnabled: z.boolean(),
  politicalProviderOk: z.boolean(),
  dltEntityId: z.string().max(40).optional().nullable(),
});

export const PATCH = route("settings.manage", async ({ req, ctx }) => {
  const b = await body(req, S);
  if (b.callWindowStart >= b.callWindowEnd) throw new ApiError(400, "Window end must be after start");
  if (b.callWindowStart < "08:00" || b.callWindowEnd > "21:00") throw new ApiError(400, "Calling window must stay within 08:00–21:00");
  if (b.contactWeeklyCap < b.contactDailyCap) throw new ApiError(400, "Weekly cap must be at least the daily cap");
  const prov = availableProviders().find((p) => p.key === b.providerKey);
  if (!prov) throw new ApiError(400, "Unknown provider");
  if (!prov.configured) throw new ApiError(400, `${prov.label} is not configured on the server yet`);
  if (b.politicalEnabled && (!b.dltEntityId || b.dltEntityId.trim().length < 5)) throw new ApiError(400, "Political calling needs your DLT principal entity ID");
  const turningOn = b.politicalEnabled && !ctx.tenant.politicalEnabled;
  if (b.providerKey !== ctx.tenant.providerKey) {
    const running = await prisma.campaign.count({ where: { tenantId: ctx.tenant.id, status: { in: ["RUNNING", "SCHEDULED"] } } });
    if (running) throw new ApiError(400, "Pause running campaigns before switching provider");
  }
  await prisma.tenant.update({
    where: { id: ctx.tenant.id },
    data: { ...b, dltEntityId: b.dltEntityId?.trim() || null, ...(turningOn ? { politicalAttestedBy: ctx.user.email, politicalAttestedAt: new Date() } : {}) },
  });
  await logAction(ctx, "settings.updated", "Tenant", ctx.tenant.id, { ...b, dltEntityId: undefined });
  return { ok: true };
});
