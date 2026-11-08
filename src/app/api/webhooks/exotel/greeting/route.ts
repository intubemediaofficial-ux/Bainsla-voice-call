import type { NextRequest } from "next/server";
import { exotelTokenOk } from "@/lib/provider/exotel";
import { attemptForExotelRequest } from "@/lib/exotel-flow";
import { signedAudioUrl } from "@/lib/dispatch";

/** Exotel "Greeting" applet (dynamic URL): returns the approved audio file for this call as a plain-text URL. */
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  if (!exotelTokenOk(u)) return new Response("Forbidden", { status: 403 });
  const a = await attemptForExotelRequest(u);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(signedAudioUrl(a.audioAssetId, 3600, "wav"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
