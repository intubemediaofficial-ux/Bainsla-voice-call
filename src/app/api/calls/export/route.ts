import { prisma } from "@/lib/db";
import { logAction, route } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { duration, rupees } from "@/lib/format";
import { fmtDateTime } from "@/lib/time";

export const GET = route("reports.export", async ({ req, ctx }) => {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  const where = {
    tenantId: ctx.tenant.id,
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59+05:30`) } : {}) } } : {}),
  };
  const rows = await prisma.callAttempt.findMany({
    where,
    include: { contact: { select: { phoneMasked: true } }, campaign: { select: { name: true } }, callerId: { select: { phoneE164: true } }, audioAsset: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200_000,
  });
  await logAction(ctx, "calls.exported", "CallAttempt", null, { rows: rows.length, from, to });
  return csvResponse(
    `call-log-${from || "all"}-${to || "now"}.csv`,
    toCsv(
      ["Time", "Number (masked)", "Campaign", "Caller ID", "Audio", "Status", "Duration", "DTMF", "Opted out", "Cost", "Reason"],
      rows.map((r) => [fmtDateTime(r.createdAt), r.contact.phoneMasked, r.campaign?.name ?? "Single call", r.callerId.phoneE164, r.audioAsset.name, r.status, duration(r.durationSeconds), r.dtmf ?? "", r.optedOut ? "yes" : "", rupees(r.costPaise), r.failureReason ?? ""]),
    ),
  );
});
