import QRCode from "qrcode";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { checkPassword } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { newTotpSecret, totpFor, verifyTotp } from "@/lib/totp";

/** Start enrolment: returns QR + secret. */
export const GET = route(null, async ({ ctx }) => {
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: ctx.user.id }, data: { mfaPendingEnc: encrypt(secret) } });
  const uri = totpFor(secret, ctx.user.email).toString();
  return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
});

/** Confirm enrolment or disable. */
export const POST = route(null, async ({ req, ctx }) => {
  const b = await body(req, z.object({ action: z.enum(["enable", "disable"]), code: z.string().optional(), password: z.string().optional() }));
  if (b.action === "enable") {
    if (!ctx.user.mfaPendingEnc) throw new ApiError(400, "Start setup again");
    const secret = decrypt(ctx.user.mfaPendingEnc);
    if (!b.code || !verifyTotp(secret, b.code)) throw new ApiError(400, "Wrong code. Check the time on your phone and try again.");
    await prisma.user.update({ where: { id: ctx.user.id }, data: { mfaEnabled: true, mfaSecretEnc: encrypt(secret), mfaPendingEnc: null } });
    await prisma.session.update({ where: { id: ctx.sessionId }, data: { mfaPassed: true } });
    await logAction(ctx, "user.mfa_enabled", "User", ctx.user.id);
    return { ok: true };
  }
  if (ctx.tenant.requireMfa) throw new ApiError(400, "Your organisation requires MFA");
  if (!b.password || !(await checkPassword(b.password, ctx.user.passwordHash))) throw new ApiError(400, "Password is wrong");
  await prisma.user.update({ where: { id: ctx.user.id }, data: { mfaEnabled: false, mfaSecretEnc: null } });
  await logAction(ctx, "user.mfa_disabled", "User", ctx.user.id);
  return { ok: true };
});
