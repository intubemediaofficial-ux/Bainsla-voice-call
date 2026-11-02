import type { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";
import { applyProviderEvent } from "@/lib/callstate";
import { json } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await params;
  let provider;
  try {
    provider = getProvider(key);
  } catch {
    return json({ error: "Unknown provider" }, 404);
  }
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > 64 * 1024) return json({ error: "Too large" }, 413);
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  if (!provider.verifyWebhook(headers, raw, new URL(req.url))) return json({ error: "Invalid signature" }, 401);
  let ev;
  try {
    ev = provider.parseWebhook(raw, headers);
  } catch {
    return json({ error: "Malformed payload" }, 400);
  }
  const result = await applyProviderEvent(key, ev);
  return json({ ok: true, result });
}
