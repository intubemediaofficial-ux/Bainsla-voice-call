"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

export function UploadAudio({ politicalEnabled, existing }: { politicalEnabled: boolean; existing: { id: string; name: string }[] }) {
  const router = useRouter();
  const f = useForm();
  const [pol, setPol] = useState(false);
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        f.setBusy(true);
        const r = await send("POST", "/api/audio", new FormData(form));
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: "Uploaded — waiting for approval" });
        form.reset();
        setPol(false);
        router.refresh();
      }}
    >
      <div><label className="label">Name</label><input name="name" className="input" required placeholder="e.g. Event invite – Hindi" /></div>
      <div><label className="label">Audio file</label><input name="file" type="file" accept=".mp3,.wav,.m4a,.ogg,.aac,audio/*" className="input py-2" required /></div>
      <div>
        <label className="label">New version of (optional)</label>
        <select name="replaceOf" className="input" defaultValue=""><option value="">— New recording —</option>{existing.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      </div>
      <div><label className="label">Transcript (optional)</label><input name="transcript" className="input" placeholder="What the message says" /></div>
      {politicalEnabled && (
        <div className="md:col-span-2 grid gap-3 rounded-xl bg-amber-50 p-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-amber-900"><input type="checkbox" name="forPolitical" value="yes" checked={pol} onChange={(e) => setPol(e.target.checked)} /> Election / political message</label>
          {pol && <input name="mcmcCertificate" className="input" required placeholder="MCMC certificate number" />}
        </div>
      )}
      <div className="md:col-span-2 flex flex-col gap-2"><Msg msg={f.msg} /><div><Submit busy={f.busy}>Upload</Submit></div></div>
    </form>
  );
}
