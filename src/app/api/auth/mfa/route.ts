import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, errorResponse, json } from "@/lib/api";
import { getCtx } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/redis";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { code } = await body(req, z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }));
    const ctx = await getCtx();
    if (!ctx) throw new ApiError(401, "Login again");
    if (!(await rateLimit(`mfa:${ctx.user.id}`, 8, 600))) throw new ApiError(429, "Too many attempts. Try again later.");
    if (!ctx.user.mfaSecretEnc || !verifyTotp(decrypt(ctx.user.mfaSecretEnc), code)) throw new ApiError(401, "Wrong code");
    await prisma.session.update({ where: { id: ctx.sessionId }, data: { mfaPassed: true } });
    await audit({ id: ctx.user.id, email: ctx.user.email, tenantId: ctx.user.tenantId, ip: ctx.ip }, "auth.mfa_passed", "User", ctx.user.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
