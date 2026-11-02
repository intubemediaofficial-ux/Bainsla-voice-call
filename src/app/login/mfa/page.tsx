"use client";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Msg, send, Submit, useForm } from "@/components/client";

export default function MfaPage() {
  const f = useForm();
  const [code, setCode] = useState("");
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold text-ink-900">Two-step verification</h2>
      <p className="mt-1 text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          f.setBusy(true);
          const r = await send("POST", "/api/auth/mfa", { code });
          f.setBusy(false);
          if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
          window.location.href = "/dashboard";
        }}
      >
        <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Msg msg={f.msg} />
        <Submit busy={f.busy} className="btn-primary w-full">Verify</Submit>
      </form>
    </AuthFrame>
  );
}
