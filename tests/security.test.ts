import { describe, expect, it } from "vitest";
import { safeCell, toCsv } from "@/lib/csv";
import { decrypt, encrypt, hashPhone, safeEqual } from "@/lib/crypto";
import { can } from "@/lib/rbac";
import { newTotpSecret, totpFor, verifyTotp } from "@/lib/totp";

describe("csv export", () => {
  it("neutralises spreadsheet formulas", () => {
    for (const v of ["=HYPERLINK(1)", "+1", "-2", "@SUM(A1)"]) expect(safeCell(v).startsWith("'")).toBe(true);
    expect(safeCell("hello")).toBe("hello");
  });
  it("quotes commas and quotes", () => {
    expect(toCsv(["a"], [['x,"y"']])).toBe('\uFEFFa\r\n"x,""y"""');
  });
});

describe("pii crypto", () => {
  it("round-trips with random IVs", () => {
    const a = encrypt("+919876543210");
    expect(a).not.toBe(encrypt("+919876543210"));
    expect(decrypt(a)).toBe("+919876543210");
  });
  it("detects tampering", () => {
    const a = encrypt("+919876543210");
    const b = a.slice(0, -2) + (a.endsWith("A") ? "B" : "A") + a.slice(-1);
    expect(() => decrypt(b)).toThrow();
  });
  it("hashes phones deterministically", () => {
    expect(hashPhone("+919876543210")).toBe(hashPhone("+919876543210"));
    expect(hashPhone("+919876543210")).not.toBe(hashPhone("+919876543211"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("rbac", () => {
  it("limits roles", () => {
    expect(can("ADMIN", "staff.manage")).toBe(true);
    expect(can("AUDITOR", "audit.read")).toBe(true);
    expect(can("AUDITOR", "campaigns.write")).toBe(false);
    expect(can("OPERATOR", "staff.manage")).toBe(false);
  });
});

describe("totp", () => {
  it("accepts the current code only", () => {
    const s = newTotpSecret();
    expect(verifyTotp(s, totpFor(s, "x").generate())).toBe(true);
    expect(verifyTotp(s, "000000") && verifyTotp(s, "111111")).toBe(false);
  });
});
