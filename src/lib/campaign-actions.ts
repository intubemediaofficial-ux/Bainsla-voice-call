import type { Campaign, CampaignStatus } from "@prisma/client";
import { prisma } from "./db";
import { materializeRecipients, validateCampaign } from "./campaign";
import { can } from "./rbac";
import type { Ctx } from "./auth";

export class ActionError extends Error {}

export const ACTIONS = ["submit", "approve", "reject", "start", "pause", "resume", "cancel"] as const;
export type CampaignAction = (typeof ACTIONS)[number];

const FROM: Record<CampaignAction, CampaignStatus[]> = {
  submit: ["DRAFT"],
  approve: ["NEEDS_REVIEW"],
  reject: ["NEEDS_REVIEW", "APPROVED"],
  start: ["APPROVED"],
  pause: ["RUNNING", "SCHEDULED"],
  resume: ["PAUSED"],
  cancel: ["DRAFT", "NEEDS_REVIEW", "APPROVED", "SCHEDULED", "RUNNING", "PAUSED"],
};

export async function startRunning(c: Campaign) {
  const total = await materializeRecipients(c);
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "RUNNING", startedAt: new Date(), audienceCount: total } });
  return total;
}

export async function runCampaignAction(ctx: Ctx, c: Campaign, action: CampaignAction, note?: string): Promise<Record<string, unknown>> {
  if (!FROM[action].includes(c.status)) throw new ActionError(`Cannot ${action} a campaign that is ${c.status.toLowerCase().replace("_", " ")}`);
  const role = ctx.user.role;
  const need = action === "submit" ? "campaigns.write" : action === "approve" || action === "reject" ? "campaigns.approve" : "campaigns.control";
  if (!can(role, need)) throw new ActionError("You do not have permission for this action");
  const now = new Date();
  switch (action) {
    case "submit": {
      const v = await validateCampaign(c);
      if (!v.ok) throw new ActionError(`Fix before submitting: ${v.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`);
      await prisma.campaign.update({
        where: { id: c.id },
        data: { status: "NEEDS_REVIEW", submittedAt: now, audienceCount: v.audience, estimatedCostPaise: v.costPaise, needsSecondApproval: v.audience > ctx.tenant.secondApprovalAbove, reviewNote: null },
      });
      return { audience: v.audience };
    }
    case "approve": {
      const v = await validateCampaign(c);
      if (!v.ok) throw new ActionError(`Checks failing: ${v.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`);
      if (!c.approvedById) {
        await prisma.campaign.update({
          where: { id: c.id },
          data: { approvedById: ctx.user.id, approvedAt: now, audienceCount: v.audience, estimatedCostPaise: v.costPaise, ...(c.needsSecondApproval ? {} : { status: "APPROVED" }) },
        });
        return { stage: c.needsSecondApproval ? "first" : "approved" };
      }
      if (c.approvedById === ctx.user.id) throw new ActionError("Second approval must be given by a different person");
      await prisma.campaign.update({ where: { id: c.id }, data: { secondApprovedById: ctx.user.id, secondApprovedAt: now, status: "APPROVED" } });
      return { stage: "approved" };
    }
    case "reject":
      if (!note) throw new ActionError("Write what needs to change");
      await prisma.campaign.update({ where: { id: c.id }, data: { status: "DRAFT", reviewNote: note, approvedById: null, approvedAt: null, secondApprovedById: null, secondApprovedAt: null } });
      return {};
    case "start": {
      const v = await validateCampaign(c);
      if (!v.ok) throw new ActionError(`Checks failing: ${v.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`);
      if (c.scheduledAt && c.scheduledAt > now) {
        await prisma.campaign.update({ where: { id: c.id }, data: { status: "SCHEDULED" } });
        return { scheduled: true };
      }
      return { recipients: await startRunning(c) };
    }
    case "pause":
      await prisma.campaign.update({ where: { id: c.id }, data: { status: "PAUSED", pausedAt: now } });
      return {};
    case "resume": {
      if (!c.startedAt) {
        await prisma.campaign.update({ where: { id: c.id }, data: { status: "APPROVED", pausedAt: null } });
        return runCampaignAction(ctx, { ...c, status: "APPROVED" }, "start");
      }
      const v = await validateCampaign(c);
      if (!v.ok && v.items.some((i) => !i.ok && i.key !== "audience")) throw new ActionError(`Checks failing: ${v.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`);
      await prisma.campaign.update({ where: { id: c.id }, data: { status: "RUNNING", pausedAt: null } });
      return {};
    }
    case "cancel":
      await prisma.$transaction([
        prisma.campaign.update({ where: { id: c.id }, data: { status: "CANCELLED", cancelledAt: now } }),
        prisma.campaignRecipient.updateMany({ where: { campaignId: c.id, status: { in: ["PENDING", "QUEUED"] } }, data: { status: "CANCELLED", skipReason: "CAMPAIGN_CANCELLED" } }),
      ]);
      return {};
  }
}
