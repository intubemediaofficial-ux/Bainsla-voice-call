import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";
import { parseSheet, parseLooseDate } from "@/lib/import";
import { importRows } from "@/lib/importer";

export const maxDuration = 300;

export const POST = route("contacts.write", async ({ req, ctx }) => {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose an Excel or CSV file");
  if (file.size > 15 * 1024 * 1024) throw new ApiError(400, "File is larger than 15 MB — split it into parts");
  const purposeId = String(fd.get("purposeId") || "");
  const purpose = await prisma.purpose.findFirst({ where: { id: purposeId, tenantId: ctx.tenant.id, active: true } });
  if (!purpose) throw new ApiError(400, "Choose the call purpose these people agreed to");
  if (fd.get("attest") !== "yes") throw new ApiError(400, "Confirm that every person in this file gave consent for this purpose");
  if (purpose.category === "POLITICAL" && !ctx.tenant.politicalEnabled) throw new ApiError(400, "Political calling is disabled in Settings");
  let parsed;
  try {
    parsed = await parseSheet(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    throw new ApiError(400, e instanceof Error ? e.message : "Could not read file");
  }
  if (parsed.rows.length > 100_000) throw new ApiError(400, "Max 100,000 rows per file");
  const tags = String(fd.get("tags") || "").split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  const dd = String(fd.get("defaultDate") || "");
  const result = await importRows(parsed.rows, {
    tenant: ctx.tenant,
    actorId: ctx.user.id,
    purposeId,
    fileName: file.name,
    tags,
    channel: String(fd.get("channel") || "import").slice(0, 40),
    defaultSource: String(fd.get("defaultSource") || "").slice(0, 200),
    defaultEvidence: String(fd.get("defaultEvidence") || "").slice(0, 200),
    defaultDate: dd ? parseLooseDate(dd) : null,
  });
  await logAction(ctx, "contacts.imported", "ContactImport", result.importId, { file: file.name, purpose: purpose.name, created: result.created, updated: result.updated, rejected: result.rejected });
  return result;
});
