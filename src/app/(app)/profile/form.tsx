"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Msg, send, Submit, useForm } from "@/components/client";

export function PasswordForm() {
  const f = useForm();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
        if (d.next !== d.confirm) return f.setMsg({ ok: false, text: "New passwords do not match" });
        f.setBusy(true);
        const r = await send("POST", "/api/profile/password", { current: d.current, next: d.next });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        form.reset();
        f.setMsg({ ok: true, text: "Password changed. Other devices were signed out." });
      }}
    >
      <input name="current" type="password" className="input" placeholder="Current password" required autoComplete="current-password" />
      <input name="next" type="password" className="input" placeholder="New password (10+ characters)" required autoComplete="new-password" />
      <input name="confirm" type="password" className="input" placeholder="Repeat new password" required autoComplete="new-password" />
      <Msg msg={f.msg} />
      <Submit busy={f.busy}>Save password</Submit>
    </form>
  );
}

export function MfaSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const f = useForm();
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  if (enabled)
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          f.setBusy(true);
          const r = await send("POST", "/api/profile/mfa", { action: "disable", password });
          f.setBusy(false);
          if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
          router.refresh();
        }}
      >
        <p className="text-sm text-slate-600">A code from your authenticator app is needed at every sign-in.</p>
        <input type="password" className="input" placeholder="Password to turn off" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Msg msg={f.msg} />
        <Submit busy={f.busy} className="btn-ghost">Turn off</Submit>
      </form>
    );
  return qr ? (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        const r = await send("POST", "/api/profile/mfa", { action: "enable", code });
        f.setBusy(false);
        if (!r.ok) return f.setMsg({ ok: false, text: String(r.data.error) });
        router.refresh();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.qr} alt="Scan with authenticator app" className="h-44 w-44 rounded-xl border" />
      <p className="break-all text-xs text-slate-500">Or enter key: <code>{qr.secret}</code></p>
      <input className="input tracking-[0.3em]" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
      <Msg msg={f.msg} />
      <Submit busy={f.busy}>Confirm & turn on</Submit>
    </form>
  ) : (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Protect your account with Google Authenticator or any TOTP app.</p>
      <button
        className="btn-primary"
        onClick={async () => {
          const r = await send("GET", "/api/profile/mfa");
          if (r.ok) setQr(r.data as { qr: string; secret: string });
        }}
      >
        Set up
      </button>
    </div>
  );
}
