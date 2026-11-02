import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { hashPhone } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";

export const GET = route("calls.single", async ({ req, ctx }) => {
  const p = normalizePhone(new URL(req.url).searchParams.get("phone") || "");
  if (!p.ok) throw new ApiError(400, p.error);
  const c = await prisma.contact.findUnique({ where: { tenantId_phoneHash: { tenantId: ctx.tenant.id, phoneHash: hashPhone(p.e164) } } });
  if (!c || c.phoneEnc === "erased") throw new ApiError(404, "This number is not in your contacts. Add it with its consent first.");
  return { id: c.id, masked: c.phoneMasked };
});
