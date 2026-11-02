import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type Actor = { id?: string | null; email?: string | null; tenantId?: string | null; ip?: string | null };

const SENSITIVE = /phone|password|secret|token|otp|code|evidence|name$/i;

function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v == null) return v;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) && typeof val === "string" ? "[redacted]" : redact(val, depth + 1);
    }
    return out;
  }
  return v;
}

export async function audit(
  actor: Actor,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId ?? null,
      actorId: actor.id ?? null,
      actorEmail: actor.email ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: redact(metadata) as Prisma.InputJsonValue,
      ip: actor.ip ?? null,
    },
  });
}
