import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";
import { getProvider } from "@/lib/provider";

/** Pull the numbers that the provider says belong to this account. Only these can ever become VERIFIED. */
export const POST = route("callerids.manage", async ({ ctx }) => {
  const provider = getProvider(ctx.tenant.providerKey);
  if (!provider.configured()) throw new ApiError(400, `${provider.label} is not configured yet`);
  let nums;
  try {
    nums = await provider.listVerifiedCallerIds(ctx.tenant.id);
  } catch (e) {
    throw new ApiError(502, `Provider error: ${e instanceof Error ? e.message : "unknown"}`);
  }
  const onAccount = new Map(nums.map((n) => [n.phone, n.ref]));
  const mine = await prisma.callerId.findMany({ where: { tenantId: ctx.tenant.id, providerKey: provider.key } });
  let verified = 0;
  let revoked = 0;
  let added = 0;
  for (const c of mine) {
    if (onAccount.has(c.phoneE164) && c.verificationStatus !== "VERIFIED" && c.verificationStatus !== "REJECTED") {
      await prisma.callerId.update({ where: { id: c.id }, data: { verificationStatus: "VERIFIED", providerRef: onAccount.get(c.phoneE164), verifiedAt: new Date() } });
      verified++;
    } else if (!onAccount.has(c.phoneE164) && c.verificationStatus === "VERIFIED") {
      await prisma.callerId.update({ where: { id: c.id }, data: { verificationStatus: "REVOKED" } });
      revoked++;
    }
  }
  const known = new Set(mine.map((m) => m.phoneE164));
  for (const n of nums) {
    if (known.has(n.phone)) continue;
    await prisma.callerId.create({
      data: { tenantId: ctx.tenant.id, phoneE164: n.phone, label: `Provider number ${n.phone.slice(-4)}`, providerKey: provider.key, providerRef: n.ref, verificationStatus: "VERIFIED", verifiedAt: new Date(), approvedCategories: ["TRANSACTIONAL", "SERVICE"] },
    });
    added++;
  }
  await logAction(ctx, "callerid.synced", "CallerId", null, { provider: provider.key, verified, revoked, added });
  return { ok: true, onAccount: nums.length, verified, revoked, added };
});
