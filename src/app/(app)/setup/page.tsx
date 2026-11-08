import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getProvider } from "@/lib/provider";
import { exotelFlowUrls } from "@/lib/exotel-flow";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Go-live setup" };

function Step({ done, title, text, href, link }: { done: boolean; title: string; text: string; href?: string; link?: string }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex gap-3 py-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${done ? "text-emerald-600" : "text-slate-300"}`} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-900">{title}</div>
        <p className="text-sm text-slate-600">{text}</p>
      </div>
      {href && <Link href={href} className="shrink-0 self-center text-sm font-semibold text-brand-600">{link ?? "Open"}</Link>}
    </li>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-900">{value}</code>
    </div>
  );
}

export default async function SetupPage() {
  const ctx = await requirePage("settings.manage");
  const t = ctx.tenant;
  const now = new Date();
  const live = t.providerKey !== "mock";
  const exotelReady = getProvider("exotel").configured();
  const [callerIds, politicalCallerIds, audio, mcmcAudio, consents, campaigns, silence] = await Promise.all([
    prisma.callerId.count({ where: { tenantId: t.id, providerKey: t.providerKey, verificationStatus: "VERIFIED" } }),
    prisma.callerId.count({ where: { tenantId: t.id, providerKey: t.providerKey, verificationStatus: "VERIFIED", approvedCategories: { has: "POLITICAL" } } }),
    prisma.audioAsset.count({ where: { tenantId: t.id, approvalStatus: "APPROVED" } }),
    prisma.audioAsset.count({ where: { tenantId: t.id, approvalStatus: "APPROVED", forPolitical: true, mcmcCertificate: { not: null } } }),
    prisma.consentRecord.count({ where: { tenantId: t.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.campaign.count({ where: { tenantId: t.id } }),
    prisma.silencePeriod.count({ where: { tenantId: t.id, endsAt: { gt: now } } }),
  ]);
  const urls = exotelFlowUrls();
  return (
    <>
      <PageHeader title="Go-live setup" subtitle="Everything needed before real calls go out, with live status." />
      <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${live ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        {live ? `Live provider: ${getProvider(t.providerKey).label}. Real calls will be placed.` : "Test mode: the mock provider is active, so no real phone calls are placed. Calls, answers and opt-outs are simulated."}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Regular calls">
          <ol className="divide-y divide-slate-100">
            <Step done={exotelReady} title="1. Telephony provider account" text={exotelReady ? "Exotel keys are configured on the server." : "Needs an Exotel account with API key, API token, Account SID, an ExoPhone (caller number) and a call flow."} />
            <Step done={live} title="2. Switch provider to Exotel" text="Settings → Telephony provider. Do this only after a test call to your own number works." href="/settings" />
            <Step done={callerIds > 0} title="3. Verified caller ID" text={`${callerIds} verified for the current provider. Use Caller IDs → Sync, then approve the categories each number may be used for.`} href="/caller-ids" />
            <Step done={audio > 0} title="4. Approved audio" text={`${audio} approved. Upload MP3/WAV (1 s – 5 min) and approve it. The message should end with “Press 9 to stop these calls”.`} href="/audio" />
            <Step done={consents > 0} title="5. Contacts with consent" text={`${consents} active consent records. Excel must include phone, consent source, consent date and proof for every row.`} href="/contacts" />
            <Step done={campaigns > 0} title="6. First campaign" text="Create → submit → approve → start. Calls run only inside the calling window and the daily caps." href="/campaigns/new" />
          </ol>
        </Card>
        <Card title="Election / political calls">
          <ol className="divide-y divide-slate-100">
            <Step done={t.politicalEnabled} title="Political calling enabled" text="Settings → Election safeguards." href="/settings" />
            <Step done={t.politicalProviderOk} title="Provider approval for political calls" text="Written approval from the provider for political voice broadcasts." href="/settings" />
            <Step done={Boolean(t.dltEntityId)} title="DLT principal entity ID" text={t.dltEntityId ? `Entity ID ${t.dltEntityId}` : "Registered on a TRAI DLT portal by the party/candidate or agency."} href="/settings" />
            <Step done={politicalCallerIds > 0} title="Caller ID approved for political" text={`${politicalCallerIds} caller IDs allowed for political calls.`} href="/caller-ids" />
            <Step done={mcmcAudio > 0} title="MCMC-certified audio" text={`${mcmcAudio} approved political audio with an MCMC certificate number.`} href="/audio" />
            <Step done={silence > 0} title="Silence periods" text="Add the 48-hour no-campaign window before polling for each phase." href="/settings" />
          </ol>
          <p className="mt-3 text-xs text-slate-500">Voter lists or bought data are not consent. Political calls run 09:00–21:00 only and only as approved campaigns.</p>
        </Card>
      </div>
      <Card title={<span className="flex items-center gap-2">Exotel call-flow URLs {urls ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Waiting for keys</Badge>}</span>} className="mt-6">
        {urls ? (
          <>
            <p className="mb-2 text-sm text-slate-600">In Exotel App Bazaar create a flow: <b>Greeting</b> (dynamic URL) → <b>Gather</b> (1 digit, “press 9 to stop”) → <b>Passthru</b> → Hangup. Put the flow ID in the server env as EXOTEL_FLOW_ID.</p>
            <UrlRow label="Greeting — dynamic audio URL" value={urls.greeting} />
            <UrlRow label="Passthru after Gather (records key 9)" value={urls.passthru} />
            <UrlRow label="Status callback (set automatically on each call)" value={urls.status} />
          </>
        ) : (
          <p className="text-sm text-slate-600">These links appear here once the Exotel keys are added on the server.</p>
        )}
      </Card>
    </>
  );
}
