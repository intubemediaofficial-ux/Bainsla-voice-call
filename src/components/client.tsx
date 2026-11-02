"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export async function send(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const isForm = body instanceof FormData;
  const r = await fetch(url, {
    method,
    headers: isForm || body === undefined ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = await r.json();
  } catch {}
  if (r.status === 401) window.location.href = "/login";
  return { ok: r.ok, data };
}

export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <div className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{msg.text}</div>;
}

/** Button that calls an API then refreshes the page data. */
export function ActionButton({
  url, method = "POST", body, children, className = "btn-ghost", confirm, prompt, onDone, success,
}: {
  url: string; method?: string; body?: Record<string, unknown>; children: ReactNode; className?: string; confirm?: string; prompt?: string;
  onDone?: (d: Record<string, unknown>) => void; success?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        className={className}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          let extra = {};
          if (prompt) {
            const v = window.prompt(prompt);
            if (v === null) return;
            extra = { note: v, reason: v };
          }
          setBusy(true);
          setErr(null);
          const r = await send(method, url, { ...(body ?? {}), ...extra });
          setBusy(false);
          if (!r.ok) return setErr(String(r.data.error ?? "Failed"));
          if (success) setOk(success);
          onDone?.(r.data);
          router.refresh();
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
      {err && <span className="max-w-xs text-xs text-rose-600">{err}</span>}
      {ok && <span className="text-xs text-emerald-700">{ok}</span>}
    </span>
  );
}

export function Submit({ busy, children, className = "btn-primary" }: { busy: boolean; children: ReactNode; className?: string }) {
  return (
    <button type="submit" disabled={busy} className={className}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function useForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return { busy, setBusy, msg, setMsg };
}
