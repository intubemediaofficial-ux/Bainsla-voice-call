import { describe, expect, it } from "vitest";
import { exotelProvider, exotelTokenOk } from "@/lib/provider/exotel";

process.env.EXOTEL_WEBHOOK_TOKEN = "tok-123";

describe("exotel adapter", () => {
  it("accepts only the configured callback token", () => {
    expect(exotelTokenOk(new URL("https://x/cb?t=tok-123"))).toBe(true);
    expect(exotelTokenOk(new URL("https://x/cb?t=wrong"))).toBe(false);
    expect(exotelTokenOk(new URL("https://x/cb"))).toBe(false);
  });

  it("parses JSON status callbacks", () => {
    const ev = exotelProvider.parseWebhook(Buffer.from(JSON.stringify({ CallSid: "abc", Status: "completed", ConversationDuration: "42", EventType: "terminal" })), {});
    expect(ev).toMatchObject({ providerCallId: "abc", status: "COMPLETED", durationSeconds: 42 });
  });

  it("parses form-encoded status callbacks", () => {
    const ev = exotelProvider.parseWebhook(Buffer.from("CallSid=xyz&Status=no-answer&Duration=0"), {});
    expect(ev).toMatchObject({ providerCallId: "xyz", status: "NO_ANSWER", durationSeconds: 0 });
  });
});
