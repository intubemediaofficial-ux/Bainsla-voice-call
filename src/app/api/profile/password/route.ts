import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { checkPassword, hashPassword } from "@/lib/auth";

export const POST = route(null, async ({ req, ctx }) => {
  const b = await body(req, z.object({ current: z.string().min(1), next: z.string().min(10, "New password must be at least 10 characters").max(200) }));
  if (!(await checkPassword(b.current, ctx.user.passwordHash))) throw new ApiError(400, "Current password is wrong");
  if (b.current === b.next) throw new ApiError(400, "Choose a different password");
  await prisma.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(b.next), mustChangePw: false } });
  await prisma.session.deleteMany({ where: { userId: ctx.user.id, id: { not: ctx.sessionId } } });
  await logAction(ctx, "user.password_changed", "User", ctx.user.id);
  return { ok: true };
});
