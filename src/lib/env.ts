const isProd = process.env.NODE_ENV === "production";

function need(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd && !process.env.BV_ALLOW_DEV_SECRETS) throw new Error(`Missing required env ${name}`);
  return devFallback;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    return need("APP_SECRET", "dev-app-secret-change-me-0123456789abcdef");
  },
  get piiKey() {
    return need("PII_ENCRYPTION_KEY", "ZGV2LXBpaS1rZXktMzItYnl0ZXMtLS0tLS0tLS0tLS0=");
  },
  get hashKey() {
    return need("PHONE_HASH_KEY", "dev-phone-hash-key");
  },
  get redisUrl() {
    return process.env.REDIS_URL || "redis://127.0.0.1:6379/0";
  },
  get audioDir() {
    return process.env.AUDIO_DIR || "./data/audio";
  },
  get mockWebhookSecret() {
    return need("MOCK_WEBHOOK_SECRET", "dev-mock-webhook-secret");
  },
  get mockNumbers() {
    return (process.env.MOCK_PROVIDER_NUMBERS || "+918045000001,+918045000002")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get cookieSecure() {
    return isProd && process.env.COOKIE_SECURE !== "0";
  },
};
