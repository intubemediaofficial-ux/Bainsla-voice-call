"use client";
import { useState } from "react";
import { AudioLines, CheckCircle2 } from "lucide-react";
import { Msg, send, Submit, useForm } from "@/components/client";

export default function OptOutPage() {
  const f = useForm();
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700 p-5">
      <div className="card w-full max-w-md p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-saffron-500 text-white"><AudioLines className="h-5 w-5" /></div>
          <div>
            <div className="font-bold text-ink-900">Stop calls from Bainsla Voice</div>
            <div className="text-xs text-slate-500">Works for every organisation that calls through this platform</div>
          </div>
        </div>
        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-3 font-semibold text-ink-900">{done} will not receive any more calls.</p>
            <p className="mt-1 text-sm text-slate-500">It can take up to a few minutes for calls already ringing to stop.</p>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              f.setBusy(true);
              const r = await send("POST", "/api/public/opt-out", { phone, confirm });
              f.setBusy(false);
              if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
              setDone(String(r.data.masked));
            }}
          >
            <div>
              <label className="label" htmlFor="phone">Your mobile number</label>
              <input id="phone" className="input" inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" className="mt-0.5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              I want to stop receiving automated voice calls on this number.
            </label>
            <Msg msg={f.msg} />
            <Submit busy={f.busy} className="btn-primary w-full">Stop calls</Submit>
            <p className="text-center text-xs text-slate-400">You can also press 9 during any call.</p>
          </form>
        )}
      </div>
    </div>
  );
}
