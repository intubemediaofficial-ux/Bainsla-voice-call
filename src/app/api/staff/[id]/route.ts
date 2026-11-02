import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";

export const PATCH = route<{ id: string }>("staff.manage", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"]).optional(), status: z.enum(["ACTIVE", "DISABLED"]).optional(), resetPassword: z.boolean().optional(), resetMfa: z.boolean().optional() }));
  const u = await prisma.user.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!u) throw new ApiError(404, "Not found");
  if (u.id === ctx.user.id && (b.role || b.status)) throw new ApiError(400, "You cannot change your own role or status");
  if ((b.role && b.role !== "ADMIN") || b.status === "DISABLED") {
    if (u.role === "ADMIN") {
      const admins = await prisma.user.count({ where: { tenantId: ctx.tenant.id, role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) throw new ApiError(400, "Keep at least one active admin");
    }
  }
  let tempPassword: string | undefined;
  if (b.resetPassword) tempPassword = randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) + "!7a";
  await prisma.user.update({
    where: { id: u.id },
    data: {
      ...(b.role ? { role: b.role } : {}),
      ...(b.status ? { status: b.status } : {}),
      ...(tempPassword ? { passwordHash: await hashPassword(tempPassword), mustChangePw: true, failedLogins: 0, lockedUntil: null } : {}),
      ...(b.resetMfa ? { mfaEnabled: false, mfaSecretEnc: null } : {}),
    },
  });
  if (b.status === "DISABLED" || tempPassword || b.resetMfa) await prisma.session.deleteMany({ where: { userId: u.id } });
  await logAction(ctx, "staff.updated", "User", u.id, { role: b.role, status: b.status, reset: Boolean(tempPassword), resetMfa: b.resetMfa });
  return { ok: true, tempPassword };
});
