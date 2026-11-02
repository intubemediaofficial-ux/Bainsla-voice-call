import { prisma } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { availableProviders } from "@/lib/provider";
import { Badge, Card, CATEGORY_LABEL, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { fmtDateTime } from "@/lib/time";
import { AddPurpose, AddSilence, SettingsForm } from "./form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requirePage("settings.manage");
  const t = ctx.tenant;
  const [purposes, silence] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: "asc" } }),
    prisma.silencePeriod.findMany({ where: { tenantId: t.id }, orderBy: { startsAt: "desc" } }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Settings" subtitle="Calling rules for your organisation." />
      <Card className={`mb-6 ${t.emergencyStop ? "border-rose-300 bg-rose-50" : ""}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold text-ink-900">Emergency stop</div>
            <p className="text-sm text-slate-600">{t.emergencyStop ? "ON — no calls are being placed and running campaigns are paused." : "Instantly stops every call and pauses all running campaigns."}</p>
          </div>
          <ActionButton url="/api/emergency" body={{ on: !t.emergencyStop }} className={t.emergencyStop ? "btn-primary" : "btn-danger"} confirm={t.emergencyStop ? "Allow calls again? Paused campaigns stay paused until you resume them." : "Stop all calls now?"}>
            {t.emergencyStop ? "Turn off emergency stop" : "STOP ALL CALLS"}
          </ActionButton>
        </div>
      </Card>
      <SettingsForm
        t={{
          name: t.name, callWindowStart: t.callWindowStart, callWindowEnd: t.callWindowEnd, tenantDailyCap: t.tenantDailyCap, contactDailyCap: t.contactDailyCap, contactWeeklyCap: t.contactWeeklyCap,
          defaultConcurrency: t.defaultConcurrency, secondApprovalAbove: t.secondApprovalAbove, maxRetries: t.maxRetries, retryBackoffSec: t.retryBackoffSec, retryNoAnswer: t.retryNoAnswer,
          failureAutoPausePct: t.failureAutoPausePct, retentionDays: t.retentionDays, requireMfa: t.requireMfa, providerKey: t.providerKey, politicalEnabled: t.politicalEnabled,
          politicalProviderOk: t.politicalProviderOk, dltEntityId: t.dltEntityId ?? "",
        }}
        providers={availableProviders()}
      />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Call purposes (consent types)">
          <ul className="mb-4 divide-y divide-slate-100">
            {purposes.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div><div className="text-sm font-semibold text-ink-900">{p.name}</div><div className="text-xs text-slate-500">{CATEGORY_LABEL[p.category]}{p.description ? ` · ${p.description}` : ""}</div></div>
                <div className="flex items-center gap-2">
                  {!p.active && <Badge>Off</Badge>}
                  <ActionButton url={`/api/purposes/${p.id}`} method="PATCH" body={{ active: !p.active }} className="text-xs font-semibold text-brand-600">{p.active ? "Turn off" : "Turn on"}</ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <AddPurpose political={t.politicalEnabled} />
        </Card>
        <Card title="Election silence periods">
          <p className="mb-3 text-sm text-slate-600">No political calls go out between these times (e.g. the 48 hours before polling ends in your area).</p>
          <ul className="mb-4 divide-y divide-slate-100">
            {silence.map((s) => {
              const active = s.startsAt <= now && s.endsAt > now;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div><div className="text-sm font-semibold text-ink-900">{s.label} {active && <Badge tone="rose">Active now</Badge>}</div><div className="text-xs text-slate-500">{fmtDateTime(s.startsAt)} → {fmtDateTime(s.endsAt)}</div></div>
                  {!active && <ActionButton url={`/api/settings/silence/${s.id}`} method="DELETE" className="text-xs font-semibold text-slate-500" confirm="Remove this silence period?">Remove</ActionButton>}
                </li>
              );
            })}
            {silence.length === 0 && <li className="py-2 text-sm text-slate-500">None added.</li>}
          </ul>
          <AddSilence />
        </Card>
      </div>
    </>
  );
}
