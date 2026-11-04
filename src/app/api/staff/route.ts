import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";

export const POST = route("staff.manage", async ({ req, ctx }) => {
  const b = await body(req, z.object({ email: z.string().email().max(200), name: z.string().min(2).max(80), role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"]) }));
  const email = b.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, "A user with this email already exists");
  const temp = randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) + "!7a";
  const u = await prisma.user.create({ data: { tenantId: ctx.tenant.id, email, name: b.name, role: b.role, passwordHash: await hashPassword(temp), mustChangePw: true } });
  await logAction(ctx, "staff.created", "User", u.id, { role: b.role });
  return { ok: true, id: u.id, tempPassword: temp };
});
