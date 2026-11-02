import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { getCtx, type Ctx } from "./auth";
import { can, type Perm } from "./rbac";
import { audit } from "./audit";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Handler<P> = (a: { req: NextRequest; ctx: Ctx; params: P }) => Promise<Response | unknown>;

/** Authenticated, tenant-scoped, permission-checked route with CSRF origin check on mutations. */
export function route<P = Record<string, string>>(perm: Perm | null, fn: Handler<P>) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) throw new ApiError(403, "Cross-site request blocked");
      const ctx = await getCtx();
      if (!ctx) throw new ApiError(401, "Login required");
      if (ctx.user.mfaEnabled && !ctx.mfaPassed) throw new ApiError(401, "MFA verification required");
      if (perm && !can(ctx.user.role, perm)) throw new ApiError(403, "You do not have permission for this action");
      const out = await fn({ req, ctx, params: (await segment?.params) as P });
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message, details: e.details }, e.status);
  if (e instanceof ZodError) return json({ error: e.issues[0]?.message || "Invalid input", details: e.issues }, 400);
  if ((e as { code?: string })?.code === "P2002") return json({ error: "Already exists" }, 409);
  console.error("[api]", e);
  return json({ error: "Something went wrong" }, 500);
}

export async function body<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  return schema.parse(raw);
}

export function actor(ctx: Ctx) {
  return { id: ctx.user.id, email: ctx.user.email, tenantId: ctx.tenant.id, ip: ctx.ip };
}

export async function logAction(ctx: Ctx, action: string, entityType: string, entityId?: string | null, meta: Record<string, unknown> = {}) {
  await audit(actor(ctx), action, entityType, entityId, meta);
}

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");
