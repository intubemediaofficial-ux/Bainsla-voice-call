"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

export function NewTenant() {
  const router = useRouter();
  const f = useForm();
  const [pw, setPw] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
        f.setBusy(true);
        const r = await send("POST", "/api/platform/tenants", { ...d, ratePerMinutePaise: Math.round(Number(d.rate) * 100) });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg(null);
        setPw(String(r.data.tempPassword));
        form.reset();
        router.refresh();
      }}
    >
      <input name="name" className="input" placeholder="Organisation name" required />
      <input name="adminName" className="input" placeholder="Admin name" required />
      <input name="adminEmail" type="email" className="input" placeholder="Admin email" required />
      <div><label className="label">Rate per minute (₹)</label><input name="rate" type="number" step="0.01" min="0.01" className="input" required /></div>
      <Msg msg={f.msg} />
      {pw && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Admin temporary password (shown once): <code className="font-mono font-bold">{pw}</code></div>}
      <Submit busy={f.busy} className="btn-primary w-full">Create</Submit>
    </form>
  );
}
