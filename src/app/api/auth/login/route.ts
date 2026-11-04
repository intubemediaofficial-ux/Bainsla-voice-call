import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, errorResponse, json } from "@/lib/api";
import { checkPassword, clientIp, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/redis";
import { audit } from "@/lib/audit";

const S = z.object({ email: z.string().email("Enter a valid email").max(200), password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await body(req, S);
    const ip = (await clientIp()) || "unknown";
    const em = email.trim().toLowerCase();
    if (!(await rateLimit(`login:ip:${ip}`, 20, 600)) || !(await rateLimit(`login:em:${em}`, 10, 600)))
      throw new ApiError(429, "Too many attempts. Try again in 10 minutes.");
    const user = await prisma.user.findUnique({ where: { email: em }, include: { tenant: true } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) throw new ApiError(423, "Account locked for 15 minutes after repeated failed logins");
    const ok = user && user.status === "ACTIVE" && (await checkPassword(password, user.passwordHash));
    if (!user || !ok) {
      if (user) {
        const fails = user.failedLogins + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: fails >= 5 ? 0 : fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
        });
        await audit({ id: user.id, email: user.email, tenantId: user.tenantId, ip }, "auth.login_failed", "User", user.id);
      }
      throw new ApiError(401, "Wrong email or password");
    }
    if (!user.isPlatformAdmin && user.tenant.status !== "ACTIVE") throw new ApiError(403, "Organisation is suspended");
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await createSession(user.id, !user.mfaEnabled);
    await audit({ id: user.id, email: user.email, tenantId: user.tenantId, ip }, "auth.login", "User", user.id, { mfa: user.mfaEnabled });
    return json({ ok: true, mfa: user.mfaEnabled });
  } catch (e) {
    return errorResponse(e);
  }
}
