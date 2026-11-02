import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import type { Tenant, User } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { env } from "./env";
import { can, type Perm } from "./rbac";

export const SESSION_COOKIE = "bv_session";
const ABSOLUTE_MS = 7 * 86400_000;
const IDLE_MS = 12 * 3600_000;

export type Ctx = { user: User; tenant: Tenant; sessionId: string; mfaPassed: boolean; ip: string | null };

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || null;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string, mfaPassed: boolean) {
  const token = randomToken(32);
  const h = await headers();
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      mfaPassed,
      ip: await clientIp(),
      userAgent: (h.get("user-agent") || "").slice(0, 200),
      expiresAt: new Date(Date.now() + ABSOLUTE_MS),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, path: "/", maxAge: ABSOLUTE_MS / 1000 });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(SESSION_COOKIE)?.value;
  if (t) await prisma.session.deleteMany({ where: { tokenHash: sha256(t) } });
  c.delete(SESSION_COOKIE);
}

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256(t) }, include: { user: { include: { tenant: true } } } });
  if (!s) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || s.lastSeenAt.getTime() + IDLE_MS < now || s.user.status !== "ACTIVE") {
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 5 * 60_000) await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  let tenant = s.user.tenant;
  if (s.user.isPlatformAdmin && s.tenantView && s.tenantView !== tenant.id) {
    tenant = (await prisma.tenant.findUnique({ where: { id: s.tenantView } })) ?? tenant;
  }
  if (!s.user.isPlatformAdmin && tenant.status !== "ACTIVE") return null;
  return { user: s.user, tenant, sessionId: s.id, mfaPassed: s.mfaPassed, ip: await clientIp() };
});

/** Page guard. Redirects to login / MFA / setup as needed. */
export async function requirePage(perm?: Perm, opts: { allowSetup?: boolean } = {}): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (ctx.user.mfaEnabled && !ctx.mfaPassed) redirect("/login/mfa");
  if (!opts.allowSetup) {
    if (ctx.user.mustChangePw) redirect("/profile?required=password");
    if (ctx.tenant.requireMfa && !ctx.user.mfaEnabled) redirect("/profile?required=mfa");
  }
  if (perm && !can(ctx.user.role, perm)) redirect("/dashboard?denied=1");
  return ctx;
}

export function ctxCan(ctx: Ctx, perm: Perm) {
  return can(ctx.user.role, perm);
}
