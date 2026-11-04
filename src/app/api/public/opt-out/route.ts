import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, errorResponse, json } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { hashPhone } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { optOutPhoneHash } from "@/lib/callstate";
import { rateLimit } from "@/lib/redis";

/** Public opt-out: the number is suppressed for every organisation on the platform. */
export async function POST(req: NextRequest) {
  try {
    const b = await body(req, z.object({ phone: z.string().min(6).max(30), confirm: z.literal(true, { message: "Please confirm" }) }));
    const ip = (await clientIp()) || "unknown";
    if (!(await rateLimit(`optout:${ip}`, 10, 3600))) throw new ApiError(429, "Too many requests. Try again later.");
    const p = normalizePhone(b.phone);
    if (!p.ok) throw new ApiError(400, p.error);
    const h = hashPhone(p.e164);
    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) await optOutPhoneHash(t.id, h, p.masked, "OPT_OUT_WEB", "Public opt-out page");
    return json({ ok: true, masked: p.masked });
  } catch (e) {
    return errorResponse(e);
  }
}
