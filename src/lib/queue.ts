import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_PREFIX = "bvoice";
export const CALLS_QUEUE = "calls";
export const MOCK_QUEUE = "mock-provider";
export const SCHED_QUEUE = "scheduler";

const g = globalThis as unknown as { __bvQueues?: Record<string, Queue> };

export function queue(name: string): Queue {
  g.__bvQueues ??= {};
  if (!g.__bvQueues[name]) g.__bvQueues[name] = new Queue(name, { connection: redis(), prefix: QUEUE_PREFIX });
  return g.__bvQueues[name];
}

export async function enqueueCall(attemptId: string, delayMs = 0) {
  await queue(CALLS_QUEUE).add(
    "submit",
    { attemptId },
    {
      jobId: `submit-${attemptId}`,
      delay: delayMs,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}
