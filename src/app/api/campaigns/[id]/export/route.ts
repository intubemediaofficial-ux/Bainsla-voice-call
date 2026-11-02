import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";
import { csvResponse, toCsv } from "@/lib/csv";
import { fmtDateTime } from "@/lib/time";

export const GET = route<{ id: string }>("reports.export", async ({ ctx, params }) => {
  const c = await prisma.campaign.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  const rows = await prisma.campaignRecipient.findMany({
    where: { campaignId: c.id },
    include: { contact: { select: { phoneMasked: true, tags: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200_000,
  });
  await logAction(ctx, "campaign.exported", "Campaign", c.id, { rows: rows.length });
  return csvResponse(
    `campaign-${c.id}.csv`,
    toCsv(["Number (masked)", "Tags", "Status", "Attempts", "Reason", "Updated"], rows.map((r) => [r.contact.phoneMasked, r.contact.tags.join(";"), r.status, r.attempts, r.skipReason ?? "", fmtDateTime(r.updatedAt)])),
  );
});
