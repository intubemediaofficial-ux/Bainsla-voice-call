import { Secret, TOTP } from "otpauth";

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpFor(secret: string, label: string) {
  return new TOTP({ issuer: "Bainsla Voice", label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}

export function verifyTotp(secret: string, code: string): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return totpFor(secret, "x").validate({ token: clean, window: 1 }) !== null;
}
