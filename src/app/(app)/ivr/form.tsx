"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Msg, send, Submit, useForm } from "@/components/client";

type Opt = { digit: string; action: string; label: string };
type Def = { prompt: string; timeoutSec: number; options: Opt[] };
const ACTIONS: Record<string, string> = { opt_out: "Opt out", interested: "Interested", callback: "Callback", repeat: "Repeat message", hangup: "Hang up" };

export function IvrEditor({ id, name: n0, def }: { id?: string; name?: string; def?: Def }) {
  const router = useRouter();
  const f = useForm();
  const [name, setName] = useState(n0 ?? "");
  const [d, setD] = useState<Def>(def ?? { prompt: "", timeoutSec: 8, options: [{ digit: "1", action: "interested", label: "Interested" }, { digit: "9", action: "opt_out", label: "Stop these calls" }] });
  const setOpt = (i: number, k: keyof Opt, v: string) => setD({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, [k]: v } : o)) });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        const r = await send(id ? "PATCH" : "POST", id ? `/api/ivr/${id}` : "/api/ivr", { name, definition: d });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg({ ok: true, text: "Saved" });
        if (!id) setName("");
        router.refresh();
      }}
    >
      <input className="input" placeholder="Flow name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="input" placeholder="Prompt text (what the keypad message says)" value={d.prompt} onChange={(e) => setD({ ...d, prompt: e.target.value })} />
      <div className="space-y-2">
        {d.options.map((o, i) => (
          <div key={i} className="grid grid-cols-[56px_1fr_1fr_32px] gap-2">
            <select className="input px-2" value={o.digit} onChange={(e) => setOpt(i, "digit", e.target.value)}>{"0123456789*#".split("").map((x) => <option key={x}>{x}</option>)}</select>
            <select className="input px-2" value={o.action} onChange={(e) => setOpt(i, "action", e.target.value)}>{Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input className="input" value={o.label} onChange={(e) => setOpt(i, "label", e.target.value)} placeholder="Label" />
            <button type="button" aria-label="Remove" className="text-slate-400 hover:text-rose-600" onClick={() => setD({ ...d, options: d.options.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600" onClick={() => setD({ ...d, options: [...d.options, { digit: "2", action: "callback", label: "" }] })}><Plus className="h-3.5 w-3.5" /> Add key</button>
      <Msg msg={f.msg} />
      <Submit busy={f.busy}>{id ? "Save new version" : "Create flow"}</Submit>
    </form>
  );
}
