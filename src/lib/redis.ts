import IORedis from "ioredis";
import { env } from "./env";

const g = globalThis as unknown as { __bvRedis?: IORedis };

export function redis(): IORedis {
  if (!g.__bvRedis) {
    g.__bvRedis = new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false });
    g.__bvRedis.on("error", () => {});
  }
  return g.__bvRedis;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const k = `bvoice:rl:${key}`;
    const n = await redis().incr(k);
    if (n === 1) await redis().expire(k, windowSec);
    return n <= limit;
  } catch {
    return true;
  }
}
