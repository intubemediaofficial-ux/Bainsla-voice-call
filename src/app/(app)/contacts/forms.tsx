"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Msg, send, Submit, useForm } from "@/components/client";
import { CATEGORY_LABEL } from "@/components/ui";

type P = { id: string; name: string; category: string };

export function ImportForm({ purposes, politicalEnabled }: { purposes: P[]; politicalEnabled: boolean }) {
  const router = useRouter();
  const f = useForm();
  const [file, setFile] = useState<File | null>(null);
  const [purposeId, setPurposeId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const sel = purposes.find((p) => p.id === purposeId);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        f.setBusy(true);
        f.setMsg(null);
        setResult(null);
        const r = await send("POST", "/api/contacts/import", fd);
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        setResult(r.data);
        router.refresh();
      }}
    >
      <label className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${file ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-brand-500 hover:bg-brand-50/40"}`}>
        {file ? <FileSpreadsheet className="h-8 w-8 text-brand-600" /> : <UploadCloud className="h-8 w-8 text-slate-400" />}
        <span className="mt-2 text-sm font-semibold text-ink-900">{file ? file.name : "Choose .xlsx or .csv file"}</span>
        <span className="text-xs text-slate-500">Columns: phone, name, consent_source, consent_date, consent_evidence, tags</span>
        <input type="file" name="file" accept=".xlsx,.csv" className="sr-only" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">They agreed to receive</label>
          <select name="purposeId" className="input" required value={purposeId} onChange={(e) => setPurposeId(e.target.value)}>
            <option value="">Choose purpose…</option>
            {purposes.filter((p) => p.category !== "POLITICAL" || politicalEnabled).map((p) => <option key={p.id} value={p.id}>{p.name} ({CATEGORY_LABEL[p.category]})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tags for this file (optional)</label>
          <input name="tags" className="input" placeholder="e.g. jaipur, booth-12" />
        </div>
      </div>
      <details className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700">File has no consent columns? Set them once for the whole file</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><label className="label">Consent source</label><input name="defaultSource" className="input" placeholder="Membership form 2026" /></div>
          <div><label className="label">Evidence / reference</label><input name="defaultEvidence" className="input" placeholder="Register book #3" /></div>
          <div><label className="label">Consent date</label><input name="defaultDate" type="date" className="input" /></div>
        </div>
      </details>
      {sel?.category === "POLITICAL" && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Election calls: only upload supporters/members who personally agreed to get these calls. Voter rolls and bought lists are not consent and must not be uploaded.
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="attest" value="yes" className="mt-0.5" required />
        I confirm every person in this file gave consent to receive these calls, and I can show the proof if asked.
      </label>
      <Msg msg={f.msg} />
      <Submit busy={f.busy}>Upload & check</Submit>
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-semibold text-emerald-900">Upload complete</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["Rows", result.total], ["New", result.created], ["Updated", result.updated], ["Duplicates", result.duplicates], ["Rejected", result.rejected]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-white px-3 py-2"><div className="text-xs text-slate-500">{String(k)}</div><div className="text-lg font-bold">{String(v)}</div></div>
            ))}
          </div>
          {Number(result.suppressed) > 0 && <p className="mt-2 text-amber-800">{String(result.suppressed)} numbers are on your opt-out list and will not be called.</p>}
          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-white p-3 text-xs">
              {(result.errors as { row: number; reason: string }[]).map((er, i) => <div key={i}>Row {er.row}: {er.reason}</div>)}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export function AddContact({ purposes }: { purposes: P[] }) {
  const router = useRouter();
  const f = useForm();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
        f.setBusy(true);
        const r = await send("POST", "/api/contacts", d);
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: r.data.created ? "Contact added" : "Existing contact updated" });
        form.reset();
        router.refresh();
      }}
    >
      <input name="phone" className="input" placeholder="Mobile number" required />
      <input name="name" className="input" placeholder="Name (optional)" />
      <select name="purposeId" className="input" required defaultValue="">
        <option value="">Consent for…</option>
        {purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input name="source" className="input" placeholder="Consent source (e.g. called our office)" required />
      <input name="evidence" className="input" placeholder="Evidence / reference" required />
      <input name="grantedAt" type="date" className="input" required />
      <input name="tags" className="input" placeholder="Tags (optional)" />
      <Msg msg={f.msg} />
      <Submit busy={f.busy} className="btn-primary w-full">Add contact</Submit>
    </form>
  );
}

export function RevealButton({ id }: { id: string }) {
  const [v, setV] = useState<string | null>(null);
  return v ? (
    <span className="whitespace-nowrap font-mono text-xs">{v}</span>
  ) : (
    <button
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600"
      onClick={async () => {
        const r = await send("GET", `/api/contacts/${id}`);
        if (r.ok) setV(`${r.data.phone}${r.data.name ? " · " + r.data.name : ""}`);
      }}
    >
      <Eye className="h-3.5 w-3.5" /> Show
    </button>
  );
}
