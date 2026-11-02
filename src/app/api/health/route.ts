import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    out.db = "ok";
  } catch {
    out.db = "down";
  }
  try {
    out.redis = (await redis().ping()) === "PONG" ? "ok" : "down";
  } catch {
    out.redis = "down";
  }
  try {
    const hb = await redis().get("bvoice:worker:heartbeat");
    out.worker = hb && Date.now() - Number(hb) < 30_000 ? "ok" : "down";
  } catch {
    out.worker = "unknown";
  }
  const ok = out.db === "ok" && out.redis === "ok";
  return json({ ok, ...out }, ok ? 200 : 503);
}
