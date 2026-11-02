import { env } from "../env";
import { hmacHex, randomToken, safeEqual } from "../crypto";
import { MOCK_QUEUE, queue } from "../queue";
import { ProviderError, type ParsedWebhook, type ProviderCallStatus, type TelephonyProvider } from "./types";

export type MockEvent = {
  providerCallId: string;
  eventId: string;
  status: ProviderCallStatus;
  durationSeconds?: number;
  dtmf?: string;
  reason?: string;
  transient?: boolean;
};

/**
 * Deterministic outcomes by the destination's last digit so behaviour is testable:
 * 0 no answer, 1 busy, 2 transient network failure, 3 invalid number, 9 answered + pressed 9 (opt-out),
 * anything else answered and completed.
 */
export function mockOutcome(to: string, audioSeconds: number): MockEvent[] {
  const d = to.slice(-1);
  const id = "";
  const dur = Math.max(1, Math.round(audioSeconds));
  const ev = (status: ProviderCallStatus, extra: Partial<MockEvent> = {}): MockEvent => ({ providerCallId: id, eventId: "", status, ...extra });
  switch (d) {
    case "0":
      return [ev("RINGING"), ev("NO_ANSWER", { reason: "No answer" })];
    case "1":
      return [ev("RINGING"), ev("BUSY", { reason: "Line busy" })];
    case "2":
      return [ev("FAILED", { reason: "Network congestion", transient: true })];
    case "3":
      return [ev("FAILED", { reason: "Invalid or unreachable number", transient: false })];
    case "9":
      return [ev("RINGING"), ev("IN_PROGRESS"), ev("COMPLETED", { durationSeconds: Math.min(dur, 12), dtmf: "9" })];
    default:
      return [ev("RINGING"), ev("IN_PROGRESS"), ev("COMPLETED", { durationSeconds: dur })];
  }
}

export function signMockBody(body: string, ts = Math.floor(Date.now() / 1000)) {
  return { ts: String(ts), sig: hmacHex(env.mockWebhookSecret, `${ts}.${body}`) };
}

export const mockProvider: TelephonyProvider = {
  key: "mock",
  label: "Mock provider (development / testing — no real calls)",
  configured: () => true,
  async listVerifiedCallerIds() {
    return env.mockNumbers.map((phone, i) => ({ phone, ref: `mock-exophone-${i + 1}` }));
  },
  async createVoiceCall(input) {
    if (!env.mockNumbers.includes(input.verifiedCallerId)) throw new ProviderError("Caller ID not verified on provider account", false);
    if (process.env.MOCK_PROVIDER_DOWN === "1") throw new ProviderError("Mock provider unavailable", true);
    const providerCallId = `mock_${randomToken(12)}`;
    const events = mockOutcome(input.to, input.audioDurationSeconds);
    let delay = 1500;
    for (let i = 0; i < events.length; i++) {
      const e = { ...events[i], providerCallId, eventId: `${providerCallId}-${i}` };
      await queue(MOCK_QUEUE).add(
        "event",
        { url: input.statusCallbackUrl, event: e },
        { delay, attempts: 6, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 2000, removeOnFail: 2000 },
      );
      delay += e.status === "IN_PROGRESS" ? Math.min(8, e.durationSeconds ?? 6) * 1000 + 2000 : 3000;
    }
    return { providerCallId, status: "SUBMITTED" };
  },
  verifyWebhook(headers, rawBody) {
    const ts = headers["x-bv-timestamp"];
    const sig = headers["x-bv-signature"];
    if (!ts || !sig || !/^\d+$/.test(ts)) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
    return safeEqual(sig, hmacHex(env.mockWebhookSecret, `${ts}.${rawBody.toString("utf8")}`));
  },
  parseWebhook(rawBody): ParsedWebhook {
    const b = JSON.parse(rawBody.toString("utf8")) as MockEvent;
    if (!b.providerCallId || !b.eventId || !b.status) throw new Error("Malformed mock webhook");
    return {
      providerCallId: b.providerCallId,
      eventId: b.eventId,
      status: b.status,
      durationSeconds: b.durationSeconds,
      dtmf: b.dtmf,
      reason: b.reason,
      transient: b.transient,
      redacted: { status: b.status, durationSeconds: b.durationSeconds, dtmf: b.dtmf, reason: b.reason },
    };
  },
};
