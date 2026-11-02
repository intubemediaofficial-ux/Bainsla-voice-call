import { AudioLines } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { fmtDateTime } from "@/lib/time";
import { UploadAudio } from "./form";

export const metadata = { title: "Audio library" };

export default async function AudioPage() {
  const ctx = await requirePage("audio.read");
  const rows = await prisma.audioAsset.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: [{ createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Audio library" subtitle="Upload your recorded message (MP3/WAV, up to 5 minutes). It is converted for phone lines and must be approved before use." />
      {ctxCan(ctx, "audio.upload") && <Card title="Upload audio" className="mb-6"><UploadAudio politicalEnabled={ctx.tenant.politicalEnabled} existing={rows.map((r) => ({ id: r.id, name: `${r.name} v${r.version}` }))} /></Card>}
      <Card pad={false} title={`Recordings (${rows.length})`}>
        {rows.length === 0 ? <Empty icon={AudioLines} title="No audio yet" /> : (
          <ul className="divide-y divide-slate-100">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900">{a.name}</span>
                    <Badge tone="violet">v{a.version}</Badge>
                    <StatusBadge s={a.approvalStatus} />
                    {a.forPolitical && <Badge tone="orange">Election · MCMC {a.mcmcCertificate}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{Math.round(a.durationSeconds)}s · {(a.sizeBytes / 1024).toFixed(0)} KB · {a.originalName} · {fmtDateTime(a.createdAt)}</div>
                  {a.rejectReason && <div className="mt-1 text-xs text-rose-600">Rejected: {a.rejectReason}</div>}
                </div>
                <audio controls preload="none" src={`/api/audio/${a.id}/stream`} className="w-full max-w-xs" />
                {ctxCan(ctx, "audio.approve") && (
                  <div className="flex gap-2">
                    {a.approvalStatus !== "APPROVED" && <ActionButton url={`/api/audio/${a.id}`} body={{ action: "approve" }} className="btn-primary py-2">Approve</ActionButton>}
                    {a.approvalStatus !== "REJECTED" && <ActionButton url={`/api/audio/${a.id}`} body={{ action: "reject" }} prompt="Reason for rejecting" className="btn-ghost py-2">Reject</ActionButton>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
