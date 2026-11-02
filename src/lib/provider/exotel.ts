import { safeEqual } from "../crypto";
import { ProviderError, type ParsedWebhook, type ProviderCallStatus, type TelephonyProvider } from "./types";

/**
 * Exotel adapter (beta). Built from Exotel's public Calls/connect + status callback docs; it must be
 * confirmed against your own Exotel account (ExoPhone, flow/applet and DLT setup) before production use.
 * Exotel does not sign status callbacks, so the callback URL carries a secret token that is checked here.
 */
const cfg = () => ({
  sid: process.env.EXOTEL_SID || "",
  apiKey: process.env.EXOTEL_API_KEY || "",
  apiToken: process.env.EXOTEL_API_TOKEN || "",
  subdomain: process.env.EXOTEL_SUBDOMAIN || "api.in.exotel.com",
  flowId: process.env.EXOTEL_FLOW_ID || "",
  webhookToken: process.env.EXOTEL_WEBHOOK_TOKEN || "",
});

function auth() {
  const c = cfg();
  return "Basic " + Buffer.from(`${c.apiKey}:${c.apiToken}`).toString("base64");
}

const STATUS: Record<string, ProviderCallStatus> = {
  queued: "SUBMITTED",
  ringing: "RINGING",
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
  "no-answer": "NO_ANSWER",
  busy: "BUSY",
  failed: "FAILED",
  canceled: "CANCELLED",
};

export const exotelProvider: TelephonyProvider = {
  key: "exotel",
  label: "Exotel (beta — confirm with your account)",
  configured() {
    const c = cfg();
    return Boolean(c.sid && c.apiKey && c.apiToken && c.flowId && c.webhookToken);
  },
  async listVerifiedCallerIds() {
    const c = cfg();
    const res = await fetch(`https://${c.subdomain}/v2_beta/Accounts/${c.sid}/IncomingPhoneNumbers`, { headers: { Authorization: auth() } });
    if (!res.ok) throw new ProviderError(`Exotel ExoPhone list failed (${res.status})`, res.status >= 500);
    const j = (await res.json()) as { incoming_phone_numbers?: { phone_number: string; sid?: string }[] };
    return (j.incoming_phone_numbers ?? []).map((n) => ({ phone: n.phone_number, ref: n.sid ?? n.phone_number }));
  },
  async createVoiceCall(input) {
    const c = cfg();
    const body = new URLSearchParams({
      From: input.to,
      CallerId: input.verifiedCallerId,
      Url: `http://my.exotel.com/${c.sid}/exoml/start_voice/${c.flowId}`,
      StatusCallback: input.statusCallbackUrl,
      "StatusCallbackEvents[0]": "terminal",
      StatusCallbackContentType: "application/json",
      CustomField: JSON.stringify({ attemptId: input.attemptId, audio: input.approvedAudioUrl }),
    });
    const res = await fetch(`https://${c.subdomain}/v1/Accounts/${c.sid}/Calls/connect.json`, {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new ProviderError(`Exotel call failed (${res.status})`, res.status >= 500 || res.status === 429);
    const j = (await res.json()) as { Call?: { Sid: string; Status: string } };
    if (!j.Call?.Sid) throw new ProviderError("Exotel response missing Call.Sid", false);
    return { providerCallId: j.Call.Sid, status: STATUS[j.Call.Status] ?? "SUBMITTED" };
  },
  verifyWebhook(_h, _b, url) {
    const t = url.searchParams.get("t") || "";
    const want = cfg().webhookToken;
    return Boolean(want) && safeEqual(t, want);
  },
  parseWebhook(rawBody): ParsedWebhook {
    const b = JSON.parse(rawBody.toString("utf8")) as Record<string, string>;
    const sid = b.CallSid;
    const st = STATUS[(b.Status || "").toLowerCase()] ?? "FAILED";
    if (!sid) throw new Error("Malformed Exotel webhook");
    const dur = Number(b.ConversationDuration ?? b.Duration ?? 0) || 0;
    return {
      providerCallId: sid,
      eventId: `${sid}-${b.EventType || "terminal"}-${b.Status}`,
      status: st,
      durationSeconds: dur,
      dtmf: b.digits ? String(b.digits).replace(/"/g, "") : undefined,
      reason: b.Status,
      transient: st === "FAILED",
      redacted: { Status: b.Status, EventType: b.EventType, Duration: dur },
    };
  },
};
