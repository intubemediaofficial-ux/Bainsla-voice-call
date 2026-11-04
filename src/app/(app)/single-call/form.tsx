"use client";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

type O = { id: string; name: string };

export function SingleCallForm({ purposes, audio, callerIds }: { purposes: (O & { category: string })[]; audio: O[]; callerIds: (O & { categories: string[] })[] }) {
  const f = useForm();
  const [purposeId, setPurposeId] = useState("");
  const [phone, setPhone] = useState("");
  const cat = purposes.find((p) => p.id === purposeId)?.category;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        f.setBusy(true);
        f.setMsg(null);
        const look = await send("GET", `/api/contacts/lookup?phone=${encodeURIComponent(phone)}`);
        if (!look.ok) {
          f.setBusy(false);
          return f.setMsg({ ok: false, text: String(look.data.error) });
        }
        const r = await send("POST", "/api/calls", { ...d, contactId: look.data.id, idempotencyKey: crypto.randomUUID() });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: "Call queued. Track it in Call logs." });
      }}
    >
      <div><label className="label">Mobile number (must already be a consented contact)</label><input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label">Purpose</label><select name="purposeId" className="input" required value={purposeId} onChange={(e) => setPurposeId(e.target.value)}><option value="">Choose…</option>{purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Caller ID</label><select name="callerIdId" className="input" required defaultValue=""><option value="">Choose…</option>{callerIds.filter((c) => !cat || c.categories.includes(cat)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Audio</label><select name="audioAssetId" className="input" required defaultValue=""><option value="">Choose…</option>{audio.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      </div>
      <Msg msg={f.msg} />
      <Submit busy={f.busy}>Call now</Submit>
    </form>
  );
}
