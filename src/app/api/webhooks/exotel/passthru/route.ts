import type { NextRequest } from "next/server";
import { exotelTokenOk } from "@/lib/provider/exotel";
import { attemptForExotelRequest } from "@/lib/exotel-flow";
import { recordDtmf } from "@/lib/callstate";

/** Exotel "Gather" → "Passthru" applet: records the key pressed (9 = stop future calls). */
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  if (!exotelTokenOk(u)) return new Response("Forbidden", { status: 403 });
  const a = await attemptForExotelRequest(u);
  if (!a) return new Response("Not found", { status: 404 });
  const digits = u.searchParams.get("digits") || "";
  if (digits) await recordDtmf(a, digits);
  return new Response("OK", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
