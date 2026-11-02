import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each(["9876543210", "09876543210", "919876543210", "+91 98765-43210", "(98765) 43210", "9.87654321e+09"])("normalizes %s", (raw) => {
    const r = normalizePhone(raw);
    expect(r).toEqual({ ok: true, e164: "+919876543210", masked: "+91 98xxxxx210" });
  });
  it("rejects empty, letters and short numbers", () => {
    expect(normalizePhone("").ok).toBe(false);
    expect(normalizePhone("98765abc10").ok).toBe(false);
    expect(normalizePhone("12345").ok).toBe(false);
  });
  it("masks non-Indian numbers", () => {
    expect(maskPhone("+14155552671")).toBe("+1415xxxx671");
  });
});
