"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";
import { CATEGORY_LABEL } from "@/components/ui";

export function RequestCallerId() {
  const router = useRouter();
  const f = useForm();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        f.setBusy(true);
        const r = await send("POST", "/api/caller-ids", Object.fromEntries(new FormData(form)));
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: "Requested. Add this number on your provider account, then press Sync." });
        form.reset();
        router.refresh();
      }}
    >
      <div><label className="label">Number</label><input name="phone" className="input" required placeholder="+91 80 4500 0000" /></div>
      <div><label className="label">Label</label><input name="label" className="input" required placeholder="Main office line" /></div>
      <Submit busy={f.busy}>Request</Submit>
      <div className="sm:col-span-3"><Msg msg={f.msg} /></div>
    </form>
  );
}

const CATS = ["TRANSACTIONAL", "SERVICE", "PROMOTIONAL", "POLITICAL"];

export function CategoryEditor({ id, value, political }: { id: string; value: string[]; political: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATS.filter((c) => c !== "POLITICAL" || political || v.includes(c)).map((c) => {
        const on = v.includes(c);
        return (
          <button
            key={c}
            type="button"
            className={`badge ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200"}`}
            onClick={async () => {
              const next = on ? v.filter((x) => x !== c) : [...v, c];
              const r = await send("PATCH", `/api/caller-ids/${id}`, { approvedCategories: next });
              if (!r.ok) return setErr(String(r.data.error));
              setErr(null);
              setV(next);
              router.refresh();
            }}
          >
            {CATEGORY_LABEL[c]}
          </button>
        );
      })}
      {err && <span className="w-full text-xs text-rose-600">{err}</span>}
    </div>
  );
}
