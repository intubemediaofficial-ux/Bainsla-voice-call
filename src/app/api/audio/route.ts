import { prisma } from "@/lib/db";
import { ApiError, logAction, route } from "@/lib/api";
import { ingestAudio } from "@/lib/audio";
import { slug } from "@/lib/format";

export const maxDuration = 120;

export const POST = route("audio.upload", async ({ req, ctx }) => {
  const fd = await req.formData();
  const file = fd.get("file");
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  if (!(file instanceof File)) throw new ApiError(400, "Choose an audio file");
  if (name.length < 2) throw new ApiError(400, "Give the audio a name");
  const replaceOf = String(fd.get("replaceOf") || "");
  const forPolitical = fd.get("forPolitical") === "yes";
  const mcmc = String(fd.get("mcmcCertificate") || "").trim().slice(0, 80);
  if (forPolitical && mcmc.length < 3) throw new ApiError(400, "Election audio needs the MCMC certificate number");
  let groupKey = slug(name) + "-" + Date.now().toString(36);
  let version = 1;
  if (replaceOf) {
    const prev = await prisma.audioAsset.findFirst({ where: { id: replaceOf, tenantId: ctx.tenant.id } });
    if (!prev) throw new ApiError(404, "Original audio not found");
    groupKey = prev.groupKey;
    version = ((await prisma.audioAsset.aggregate({ where: { tenantId: ctx.tenant.id, groupKey }, _max: { version: true } }))._max.version ?? 0) + 1;
  }
  let info;
  try {
    info = await ingestAudio(ctx.tenant.id, Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    throw new ApiError(400, e instanceof Error ? e.message : "Audio could not be processed");
  }
  const a = await prisma.audioAsset.create({
    data: {
      tenantId: ctx.tenant.id, name, groupKey, version, storageKey: info.storageKey, originalName: file.name.slice(0, 200), sha256: info.sha256,
      sizeBytes: info.sizeBytes, durationSeconds: info.durationSeconds, codec: info.codec, forPolitical, mcmcCertificate: forPolitical ? mcmc : null,
      transcript: String(fd.get("transcript") || "").slice(0, 4000) || null, uploadedById: ctx.user.id,
    },
  });
  await logAction(ctx, "audio.uploaded", "AudioAsset", a.id, { name, version, seconds: info.durationSeconds, political: forPolitical });
  return a;
});
