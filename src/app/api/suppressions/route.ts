import { z } from "zod";
import { ApiError, body, logAction, route } from "@/lib/api";
import { hashPhone } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { optOutPhoneHash } from "@/lib/callstate";

export const POST = route("suppression.write", async ({ req, ctx }) => {
  const b = await body(req, z.object({ phones: z.string().min(6).max(200_000), note: z.string().max(200).optional() }));
  const list = b.phones.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10_000);
  let added = 0;
  const bad: string[] = [];
  for (const raw of list) {
    const p = normalizePhone(raw);
    if (!p.ok) {
      bad.push(raw.slice(0, 4) + "…");
      continue;
    }
    await optOutPhoneHash(ctx.tenant.id, hashPhone(p.e164), p.masked, "MANUAL", b.note, ctx.user.id);
    added++;
  }
  if (!added) throw new ApiError(400, "No valid numbers found");
  await logAction(ctx, "suppression.added", "Suppression", null, { count: added });
  return { ok: true, added, invalid: bad.length };
});
