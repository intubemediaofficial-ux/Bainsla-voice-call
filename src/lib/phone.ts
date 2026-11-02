import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneResult = { ok: true; e164: string; masked: string } | { ok: false; error: string };

export function maskPhone(e164: string): string {
  if (e164.startsWith("+91") && e164.length === 13) return `+91 ${e164.slice(3, 5)}xxxxx${e164.slice(-3)}`;
  return e164.slice(0, Math.max(3, e164.length - 7)) + "xxxx" + e164.slice(-3);
}

export function normalizePhone(raw: unknown): PhoneResult {
  let s = String(raw ?? "").trim();
  if (!s) return { ok: false, error: "Phone number is empty" };
  if (/e\+/i.test(s) && /^\d+(\.\d+)?e\+\d+$/i.test(s)) s = Number(s).toFixed(0);
  s = s.replace(/[\s\-().]/g, "");
  if (/^00/.test(s)) s = "+" + s.slice(2);
  if (/^91\d{10}$/.test(s)) s = "+" + s;
  if (/^0\d{10}$/.test(s)) s = s.slice(1);
  if (!/^\+?\d{6,15}$/.test(s)) return { ok: false, error: "Phone number has invalid characters" };
  const p = parsePhoneNumberFromString(s, "IN");
  if (!p || !p.isValid()) return { ok: false, error: "Not a valid phone number" };
  const e164 = p.number;
  return { ok: true, e164, masked: maskPhone(e164) };
}

export function isE164(s: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(s);
}
