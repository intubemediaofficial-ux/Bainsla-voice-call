import { AudioLines, ShieldCheck, PhoneCall, Ban } from "lucide-react";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-saffron-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-saffron-500">
            <AudioLines className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Bainsla Voice</span>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">Voice campaigns that reach people who asked to hear from you.</h1>
          <p className="mt-4 text-white/65">Upload consented contacts, approve your recorded message and schedule calls through verified caller IDs — with opt-out, caps and audit built in.</p>
          <div className="mt-10 grid gap-4">
            {[
              [ShieldCheck, "Consent checked before every single call"],
              [PhoneCall, "Only provider-verified caller IDs"],
              [Ban, "Press 9 to opt out — honoured instantly"],
            ].map(([I, t], i) => {
              const Icon = I as typeof ShieldCheck;
              return (
                <div key={i} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><Icon className="h-4 w-4 text-saffron-400" /></span>
                  {t as string}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-saffron-500 text-white"><AudioLines className="h-5 w-5" /></div>
            <span className="text-lg font-bold text-ink-900">Bainsla Voice</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
