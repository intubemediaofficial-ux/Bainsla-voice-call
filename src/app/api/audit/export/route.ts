import { prisma } from "@/lib/db";
import { logAction, route } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { fmtDateTime } from "@/lib/time";

export const GET = route("audit.read", async ({ ctx }) => {
  const rows = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "desc" }, take: 50_000 });
  await logAction(ctx, "audit.exported", "AuditLog", null, { rows: rows.length });
  return csvResponse("audit-log.csv", toCsv(["Time", "Actor", "Action", "Entity", "Entity ID", "IP", "Details"], rows.map((r) => [fmtDateTime(r.createdAt), r.actorEmail ?? "system", r.action, r.entityType, r.entityId ?? "", r.ip ?? "", JSON.stringify(r.metadata)])));
});
