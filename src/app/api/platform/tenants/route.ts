import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { DEFAULT_PURPOSES } from "@/lib/defaults";

export const POST = route(null, async ({ req, ctx }) => {
  if (!ctx.user.isPlatformAdmin) throw new ApiError(403, "Platform admin only");
  const b = await body(req, z.object({ name: z.string().min(2).max(100), adminEmail: z.string().email(), adminName: z.string().min(2).max(80), ratePerMinutePaise: z.number().int().min(1).max(10000) }));
  const email = b.adminEmail.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, "That email already has an account");
  const temp = randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) + "!7a";
  const t = await prisma.tenant.create({
    data: {
      name: b.name,
      ratePerMinutePaise: b.ratePerMinutePaise,
      purposes: { create: DEFAULT_PURPOSES.filter((p) => p.category !== "POLITICAL") },
      users: { create: { email, name: b.adminName, role: "ADMIN", passwordHash: await hashPassword(temp), mustChangePw: true } },
    },
  });
  await logAction(ctx, "platform.tenant_created", "Tenant", t.id, { name: b.name });
  return { ok: true, id: t.id, tempPassword: temp };
});

export const PATCH = route(null, async ({ req, ctx }) => {
  if (!ctx.user.isPlatformAdmin) throw new ApiError(403, "Platform admin only");
  const b = await body(req, z.object({ id: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), ratePerMinutePaise: z.number().int().min(1).max(10000).optional() }));
  if (b.id === ctx.user.tenantId && b.status === "SUSPENDED") throw new ApiError(400, "Cannot suspend the platform organisation");
  await prisma.tenant.update({ where: { id: b.id }, data: { status: b.status, ratePerMinutePaise: b.ratePerMinutePaise } });
  if (b.status === "SUSPENDED") await prisma.campaign.updateMany({ where: { tenantId: b.id, status: { in: ["RUNNING", "SCHEDULED"] } }, data: { status: "PAUSED", pausedAt: new Date() } });
  await logAction(ctx, "platform.tenant_updated", "Tenant", b.id, b);
  return { ok: true };
});
