"use client";
import { useRouter } from "next/navigation";
import { Msg, send, Submit, useForm } from "@/components/client";

export function AddSuppression() {
  const router = useRouter();
  const f = useForm();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_240px_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
        f.setBusy(true);
        const r = await send("POST", "/api/suppressions", d);
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: `${r.data.added} numbers blocked${r.data.invalid ? `, ${r.data.invalid} invalid skipped` : ""}` });
        form.reset();
        router.refresh();
      }}
    >
      <div><label className="label">Numbers (one per line or comma separated)</label><textarea name="phones" rows={2} className="input" required /></div>
      <div><label className="label">Note</label><input name="note" className="input" placeholder="e.g. asked on phone" /></div>
      <Submit busy={f.busy}>Block</Submit>
      <div className="sm:col-span-3"><Msg msg={f.msg} /></div>
    </form>
  );
}
