"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";
import { CATEGORY_LABEL } from "@/components/ui";

type Opt = { id: string; name: string };

export function CampaignForm(p: {
  purposes: (Opt & { category: string })[];
  audio: (Opt & { political: boolean })[];
  callerIds: (Opt & { categories: string[] })[];
  ivr: Opt[];
  tags: { tag: string; n: number }[];
  defaults: { windowStart: string; windowEnd: string; concurrency: number };
}) {
  const router = useRouter();
  const f = useForm();
  const [purposeId, setPurposeId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const purpose = p.purposes.find((x) => x.id === purposeId);
  const political = purpose?.category === "POLITICAL";
  const callerIds = purpose ? p.callerIds.filter((c) => c.categories.includes(purpose.category)) : p.callerIds;
  const audio = political ? p.audio.filter((a) => a.political) : p.audio;
  return (
    <form
      className="grid gap-6 xl:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        f.setBusy(true);
        const r = await send("POST", "/api/campaigns", {
          ...d, segmentTags: tags, ivrFlowId: d.ivrFlowId || null, scheduledAt: d.scheduledAt || null,
          dailyCap: Number(d.dailyCap), concurrency: Number(d.concurrency), attested: d.attested === "on",
        });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        router.push(`/campaigns/${r.data.id}`);
      }}
    >
      <div className="card space-y-4 p-5 xl:col-span-2">
        <div><label className="label">Campaign name</label><input name="name" className="input" required placeholder="e.g. Diwali event reminder — Jaipur" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Purpose</label>
            <select name="purposeId" className="input" required value={purposeId} onChange={(e) => setPurposeId(e.target.value)}>
              <option value="">Choose…</option>
              {p.purposes.map((x) => <option key={x.id} value={x.id}>{x.name} ({CATEGORY_LABEL[x.category]})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Caller ID (provider-verified)</label>
            <select name="callerIdId" className="input" required defaultValue="">
              <option value="">Choose…</option>
              {callerIds.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {purpose && callerIds.length === 0 && <p className="mt-1 text-xs text-rose-600">No verified caller ID is approved for {CATEGORY_LABEL[purpose.category]} calls.</p>}
          </div>
          <div>
            <label className="label">Approved audio</label>
            <select name="audioAssetId" className="input" required defaultValue="">
              <option value="">Choose…</option>
              {audio.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {political && audio.length === 0 && <p className="mt-1 text-xs text-rose-600">Upload election audio with its MCMC certificate number first.</p>}
          </div>
          <div>
            <label className="label">IVR (keypad options)</label>
            <select name="ivrFlowId" className="input" defaultValue=""><option value="">None (9 = opt out still works)</option>{p.ivr.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </div>
        </div>
        <div>
          <label className="label">Audience — contacts with these tags (none selected = all consented contacts)</label>
          <div className="flex flex-wrap gap-2">
            {p.tags.length === 0 && <span className="text-sm text-slate-500">No tags yet.</span>}
            {p.tags.map((t) => {
              const on = tags.includes(t.tag);
              return (
                <button type="button" key={t.tag} onClick={() => setTags(on ? tags.filter((x) => x !== t.tag) : [...tags, t.tag])} className={`badge ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-brand-500"}`}>
                  {t.tag} · {t.n}
                </button>
              );
            })}
          </div>
        </div>
        <div><label className="label">How did these people give consent?</label><textarea name="consentBasis" className="input" rows={2} required placeholder="e.g. Signed membership forms at district office, 2026" /></div>
        <div><label className="label">Opt-out told in the message</label><input name="optOutMethod" className="input" required defaultValue="Press 9 to stop these calls, or visit the opt-out page" /></div>
      </div>
      <div className="card space-y-4 p-5">
        <div><label className="label">Start time (blank = start when approved)</label><input name="scheduledAt" type="datetime-local" className="input" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">From</label><input name="windowStart" type="time" className="input" required defaultValue={political ? "09:00" : p.defaults.windowStart} /></div>
          <div><label className="label">To</label><input name="windowEnd" type="time" className="input" required defaultValue={political ? "21:00" : p.defaults.windowEnd} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Calls per day</label><input name="dailyCap" type="number" min={1} className="input" required defaultValue={5000} /></div>
          <div><label className="label">At once</label><input name="concurrency" type="number" min={1} max={200} className="input" required defaultValue={p.defaults.concurrency} /></div>
        </div>
        {political && (
          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" name="attested" className="mt-0.5" required />
            I confirm this audience consists only of people who personally agreed to receive election calls from us (not a voter roll or purchased list), and the audio is MCMC certified.
          </label>
        )}
        <Msg msg={f.msg} />
        <Submit busy={f.busy} className="btn-primary w-full">Save draft</Submit>
      </div>
    </form>
  );
}
