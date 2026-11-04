"use client";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

export function LoginForm() {
  const f = useForm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        f.setMsg(null);
        const r = await send("POST", "/api/auth/login", { email, password });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        window.location.href = r.data.mfa ? "/login/mfa" : "/dashboard";
      }}
    >
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Msg msg={f.msg} />
      <Submit busy={f.busy} className="btn-primary w-full">Sign in</Submit>
    </form>
  );
}
