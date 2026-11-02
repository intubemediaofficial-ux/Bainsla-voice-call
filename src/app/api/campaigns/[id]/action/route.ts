import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, body, logAction, route } from "@/lib/api";
import { ACTIONS, ActionError, runCampaignAction } from "@/lib/campaign-actions";

export const POST = route<{ id: string }>("campaigns.read", async ({ req, ctx, params }) => {
  const b = await body(req, z.object({ action: z.enum(ACTIONS), note: z.string().max(500).optional() }));
  const c = await prisma.campaign.findFirst({ where: { id: params.id, tenantId: ctx.tenant.id } });
  if (!c) throw new ApiError(404, "Not found");
  try {
    const r = await runCampaignAction(ctx, c, b.action, b.note);
    await logAction(ctx, `campaign.${b.action}`, "Campaign", c.id, { note: b.note, ...r });
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ActionError) throw new ApiError(400, e.message);
    throw e;
  }
});
