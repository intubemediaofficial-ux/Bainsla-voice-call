import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: "brand" | "green" | "amber" | "rose" | "sky" }) {
  const tones = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-600" };
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-bold text-ink-900">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-ink-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "sky" | "violet" | "orange" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    sky: "bg-sky-50 text-sky-800 ring-sky-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
    orange: "bg-orange-50 text-orange-800 ring-orange-200",
  }[tone];
  return <span className={`badge ${t}`}>{children}</span>;
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 font-semibold text-ink-900">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-px overflow-x-auto">{children}</div>;
}

const CALL_TONE: Record<string, "slate" | "green" | "amber" | "rose" | "sky" | "violet" | "orange"> = {
  QUEUED: "slate", SUBMITTED: "sky", RINGING: "sky", IN_PROGRESS: "violet", COMPLETED: "green", NO_ANSWER: "amber", BUSY: "orange", FAILED: "rose", REJECTED: "rose", CANCELLED: "slate",
  PENDING: "amber", VERIFIED: "green", REVOKED: "rose", APPROVED: "green",
};

export function StatusBadge({ s }: { s: string }) {
  return <Badge tone={CALL_TONE[s] ?? "slate"}>{s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export const CATEGORY_LABEL: Record<string, string> = { TRANSACTIONAL: "Transactional", SERVICE: "Service", PROMOTIONAL: "Promotional", POLITICAL: "Political / Election" };
