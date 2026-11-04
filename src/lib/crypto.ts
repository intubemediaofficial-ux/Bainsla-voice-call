import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(): Buffer {
  const k = Buffer.from(env.piiKey, "base64");
  if (k.length !== 32) throw new Error("PII_ENCRYPTION_KEY must be 32 bytes base64");
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decrypt(enc: string | null | undefined): string {
  if (!enc) return "";
  if (!enc.startsWith("v1:")) throw new Error("Unknown ciphertext version");
  const raw = Buffer.from(enc.slice(3), "base64");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

export function hashPhone(e164: string): string {
  return createHmac("sha256", env.hashKey).update(e164).digest("hex");
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signValue(value: string): string {
  return hmacHex(env.appSecret, value);
}
