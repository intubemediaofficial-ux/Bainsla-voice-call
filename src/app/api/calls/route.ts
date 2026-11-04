import { z } from "zod";
import { ApiError, body, logAction, route } from "@/lib/api";
import { createSingleCall, DispatchError } from "@/lib/dispatch";
import { rateLimit } from "@/lib/redis";

export const POST = route("calls.single", async ({ req, ctx }) => {
  const b = await body(
    req,
    z.object({ contactId: z.string().min(1, "Choose a contact"), purposeId: z.string().min(1), callerIdId: z.string().min(1), audioAssetId: z.string().min(1), idempotencyKey: z.string().min(8).max(80) }),
  );
  if (!(await rateLimit(`single:${ctx.tenant.id}`, 30, 60))) throw new ApiError(429, "Too many single calls — slow down");
  try {
    const r = await createSingleCall({ ...b, tenantId: ctx.tenant.id, actorId: ctx.user.id });
    if (!r.replay) await logAction(ctx, "call.single_created", "CallAttempt", r.attempt.id);
    return { ok: true, attemptId: r.attempt.id, replay: r.replay, status: r.attempt.status };
  } catch (e) {
    if (e instanceof DispatchError) throw new ApiError(400, e.message, { code: e.code });
    throw e;
  }
});
