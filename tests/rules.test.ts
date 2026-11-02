import { describe, expect, it } from "vitest";
import { inWindow, intersectWindow, fromLocalInput } from "@/lib/time";
import { validateIvr } from "@/lib/ivr";
import { canonicalHeader, parseLooseDate, parseSheet } from "@/lib/import";

const ist = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+05:30`);

describe("calling window", () => {
  it("respects 09:00-21:00 IST", () => {
    expect(inWindow(ist("08:59"), "09:00", "21:00")).toBe(false);
    expect(inWindow(ist("09:00"), "09:00", "21:00")).toBe(true);
    expect(inWindow(ist("20:59"), "09:00", "21:00")).toBe(true);
    expect(inWindow(ist("21:00"), "09:00", "21:00")).toBe(false);
  });
  it("intersects windows", () => {
    expect(intersectWindow(["08:00", "22:00"], ["09:00", "21:00"])).toEqual(["09:00", "21:00"]);
  });
  it("parses local input as IST", () => {
    expect(fromLocalInput("2026-11-02T09:00").toISOString()).toBe("2026-11-02T03:30:00.000Z");
  });
});

describe("ivr", () => {
  it("requires 9 = opt out and unique keys", () => {
    const base = { prompt: "", timeoutSec: 8 };
    expect(validateIvr({ ...base, options: [{ digit: "1", action: "interested", label: "a" }] })).toMatch(/Key 9/);
    expect(validateIvr({ ...base, options: [{ digit: "9", action: "interested", label: "a" }] })).toMatch(/Key 9/);
    expect(validateIvr({ ...base, options: [{ digit: "9", action: "opt_out", label: "a" }, { digit: "9", action: "opt_out", label: "b" }] })).toMatch(/once/);
    expect(validateIvr({ ...base, options: [{ digit: "9", action: "opt_out", label: "Stop" }] })).toBeNull();
  });
});

describe("import parsing", () => {
  it("maps header aliases incl. Hindi", () => {
    expect(canonicalHeader("Mobile Number")).toBe("phone");
    expect(canonicalHeader("मोबाइल")).toBe("phone");
    expect(canonicalHeader("Consent Evidence")).toBe("consent_evidence");
    expect(canonicalHeader("random")).toBeNull();
  });
  it("parses dd/mm/yyyy, ISO and Excel serial dates", () => {
    expect(parseLooseDate("15/10/2026")?.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(parseLooseDate("2026-10-15")?.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(parseLooseDate("46310")?.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(parseLooseDate("yesterday")).toBeNull();
  });
  it("reads CSV rows with canonical headers", async () => {
    const csv = "Mobile,Name,Source,Consent Date,Proof\n9876543210,Ram,Form,01/10/2026,F-1\n,,,,\n";
    const { headers, rows } = await parseSheet("a.csv", Buffer.from(csv));
    expect(headers).toContain("phone");
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe("9876543210");
    expect(rows[0].consent_evidence).toBe("F-1");
  });
});
