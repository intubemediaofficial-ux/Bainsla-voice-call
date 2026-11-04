"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

const ROLES = ["ADMIN", "MANAGER", "OPERATOR", "AUDITOR"];

function TempPw({ pw }: { pw: string }) {
  return <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Temporary password (shown once, share privately): <code className="font-mono font-bold">{pw}</code></div>;
}

export function AddStaff() {
  const router = useRouter();
  const f = useForm();
  const [pw, setPw] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        f.setBusy(true);
        setPw(null);
        const r = await send("POST", "/api/staff", Object.fromEntries(new FormData(form)));
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        f.setMsg(null);
        setPw(String(r.data.tempPassword));
        form.reset();
        router.refresh();
      }}
    >
      <input name="name" className="input" placeholder="Full name" required />
      <input name="email" type="email" className="input" placeholder="Email" required />
      <select name="role" className="input" defaultValue="OPERATOR">{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select>
      <Msg msg={f.msg} />
      {pw && <TempPw pw={pw} />}
      <Submit busy={f.busy} className="btn-primary w-full">Add</Submit>
    </form>
  );
}

export function StaffActions({ id, role, status }: { id: string; role: string; status: string }) {
  const router = useRouter();
  const [pw, setPw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const patch = async (b: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await send("PATCH", `/api/staff/${id}`, b);
    if (!r.ok) return setErr(String(r.data.error));
    setErr(null);
    if (r.data.tempPassword) setPw(String(r.data.tempPassword));
    router.refresh();
  };
  return (
    <div className="flex min-w-[260px] flex-wrap items-center gap-2">
      <select className="input w-28 py-1.5 text-xs" value={role} onChange={(e) => patch({ role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r.toLowerCase()}</option>)}</select>
      <button className="text-xs font-semibold text-slate-600" onClick={() => patch({ status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>{status === "ACTIVE" ? "Disable" : "Enable"}</button>
      <button className="text-xs font-semibold text-slate-600" onClick={() => patch({ resetPassword: true }, "Reset password? They will be signed out.")}>Reset password</button>
      <button className="text-xs font-semibold text-slate-600" onClick={() => patch({ resetMfa: true }, "Turn off their 2-step verification?")}>Reset 2-step</button>
      {err && <span className="w-full text-xs text-rose-600">{err}</span>}
      {pw && <div className="w-full"><TempPw pw={pw} /></div>}
    </div>
  );
}
