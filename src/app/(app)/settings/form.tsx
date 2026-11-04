"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

type T = Record<string, string | number | boolean>;

const NUMS: [string, string, string?][] = [
  ["tenantDailyCap", "Max calls per day (whole account)"],
  ["contactDailyCap", "Max calls per person per day"],
  ["contactWeeklyCap", "Max calls per person per week"],
  ["defaultConcurrency", "Calls at the same time"],
  ["secondApprovalAbove", "Second approval needed above (recipients)"],
  ["maxRetries", "Retries for failed calls"],
  ["retryBackoffSec", "Wait before retry (seconds)"],
  ["failureAutoPausePct", "Auto-pause if failures exceed (%)"],
  ["retentionDays", "Delete call logs after (days, 0 = keep)"],
];

export function SettingsForm({ t, providers }: { t: T; providers: { key: string; label: string; configured: boolean }[] }) {
  const router = useRouter();
  const f = useForm();
  const [s, setS] = useState<T>(t);
  const set = (k: string, v: string | number | boolean) => setS({ ...s, [k]: v });
  return (
    <form
      className="card grid gap-6 p-5 lg:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        const r = await send("PATCH", "/api/settings", s);
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: "Saved" });
        router.refresh();
      }}
    >
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink-900">General</h3>
        <div><label className="label">Organisation name</label><input className="input" value={String(s.name)} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Calls from</label><input type="time" className="input" value={String(s.callWindowStart)} onChange={(e) => set("callWindowStart", e.target.value)} /></div>
          <div><label className="label">Calls until</label><input type="time" className="input" value={String(s.callWindowEnd)} onChange={(e) => set("callWindowEnd", e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Telephony provider</label>
          <select className="input" value={String(s.providerKey)} onChange={(e) => set("providerKey", e.target.value)}>
            {providers.map((p) => <option key={p.key} value={p.key} disabled={!p.configured}>{p.label}{p.configured ? "" : " — not connected"}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s.requireMfa)} onChange={(e) => set("requireMfa", e.target.checked)} /> Require 2-step verification for all staff</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s.retryNoAnswer)} onChange={(e) => set("retryNoAnswer", e.target.checked)} /> Retry calls that were not answered</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
        <h3 className="text-sm font-bold text-ink-900 sm:col-span-2 lg:col-span-1">Limits & safety</h3>
        {NUMS.map(([k, l]) => (
          <div key={k}><label className="label">{l}</label><input type="number" className="input" value={Number(s[k])} onChange={(e) => set(k, Number(e.target.value))} /></div>
        ))}
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink-900">Political / election calls</h3>
        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          Needs: a provider account approved for political voice calls, your DLT principal entity ID, MCMC-certified audio, and contacts who personally agreed to these calls. Voter lists are not consent. Calls stay within 9 AM–9 PM and stop during silence periods.
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s.politicalEnabled)} onChange={(e) => set("politicalEnabled", e.target.checked)} /> Enable election campaigns</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(s.politicalProviderOk)} onChange={(e) => set("politicalProviderOk", e.target.checked)} /> Our provider has approved political calls in writing</label>
        <div><label className="label">DLT principal entity ID</label><input className="input" value={String(s.dltEntityId)} onChange={(e) => set("dltEntityId", e.target.value)} /></div>
        <Msg msg={f.msg} />
        <Submit busy={f.busy} className="btn-primary w-full">Save settings</Submit>
      </div>
    </form>
  );
}

export function AddPurpose({ political }: { political: boolean }) {
  const router = useRouter();
  const f = useForm();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_170px_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        f.setBusy(true);
        const r = await send("POST", "/api/purposes", Object.fromEntries(new FormData(form)));
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        form.reset();
        f.setMsg(null);
        router.refresh();
      }}
    >
      <input name="name" className="input" placeholder="New purpose name" required />
      <select name="category" className="input" defaultValue="SERVICE">
        <option value="TRANSACTIONAL">Transactional</option><option value="SERVICE">Service</option><option value="PROMOTIONAL">Promotional</option>
        {political && <option value="POLITICAL">Political / Election</option>}
      </select>
      <Submit busy={f.busy}>Add</Submit>
      <div className="sm:col-span-3"><Msg msg={f.msg} /></div>
    </form>
  );
}

export function AddSilence() {
  const router = useRouter();
  const f = useForm();
  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        f.setBusy(true);
        const r = await send("POST", "/api/settings/silence", Object.fromEntries(new FormData(form)));
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        form.reset();
        f.setMsg(null);
        router.refresh();
      }}
    >
      <input name="label" className="input sm:col-span-2" placeholder="e.g. Rajasthan phase 1 polling" required />
      <div><label className="label">From</label><input name="startsAt" type="datetime-local" className="input" required /></div>
      <div><label className="label">To</label><input name="endsAt" type="datetime-local" className="input" required /></div>
      <div className="sm:col-span-2"><Msg msg={f.msg} /></div>
      <div><Submit busy={f.busy}>Add silence period</Submit></div>
    </form>
  );
}
