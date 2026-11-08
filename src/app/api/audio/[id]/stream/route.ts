import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCtx } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { safeEqual, signValue } from "@/lib/crypto";
import { audioPath, telephonyWavPath } from "@/lib/audio";

/** Audio is private: served to signed-in users of the same tenant, or to the provider via a short-lived signed URL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.audioAsset.findUnique({ where: { id } });
  if (!asset) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const exp = Number(u.searchParams.get("exp") || 0);
  const sig = u.searchParams.get("sig") || "";
  let allowed = false;
  if (exp && sig) {
    allowed = exp > Date.now() / 1000 && asset.approvalStatus === "APPROVED" && safeEqual(sig, signValue(`audio:${id}:${exp}`));
  } else {
    const ctx = await getCtx();
    allowed = Boolean(ctx && ctx.tenant.id === asset.tenantId && can(ctx.user.role, "audio.read"));
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const wav = u.searchParams.get("fmt") === "wav";
  const buf = await readFile(wav ? await telephonyWavPath(asset.storageKey) : audioPath(asset.storageKey));
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": wav ? "audio/wav" : "audio/mpeg", "Content-Length": String(buf.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
