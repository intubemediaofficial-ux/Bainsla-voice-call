import "server-only";
import { prisma } from "./db";
import { env } from "./env";

/** Finds the call attempt for an Exotel flow request (by CallSid, or by the attemptId we sent in CustomField). */
export async function attemptForExotelRequest(u: URL) {
  const sid = u.searchParams.get("CallSid") || "";
  if (sid) {
    const a = await prisma.callAttempt.findUnique({ where: { providerCallId: sid } });
    if (a) return a.providerKey === "exotel" ? a : null;
  }
  let attemptId = "";
  try {
    const cf = JSON.parse(u.searchParams.get("CustomField") || "{}") as { attemptId?: unknown };
    if (typeof cf.attemptId === "string") attemptId = cf.attemptId;
  } catch {}
  if (!attemptId) return null;
  const a = await prisma.callAttempt.findUnique({ where: { id: attemptId } });
  return a && a.providerKey === "exotel" ? a : null;
}

/** URLs to paste into the Exotel call flow (Greeting → Gather/Passthru) and the status callback. */
export function exotelFlowUrls() {
  const t = process.env.EXOTEL_WEBHOOK_TOKEN || "";
  if (!t) return null;
  const q = `t=${encodeURIComponent(t)}`;
  return {
    greeting: `${env.appUrl}/api/webhooks/exotel/greeting?${q}`,
    passthru: `${env.appUrl}/api/webhooks/exotel/passthru?${q}`,
    status: `${env.appUrl}/api/webhooks/telephony/exotel?${q}`,
  };
}
