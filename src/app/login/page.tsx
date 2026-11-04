import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const ctx = await getCtx();
  if (ctx && (!ctx.user.mfaEnabled || ctx.mfaPassed)) redirect("/dashboard");
  return (
    <AuthFrame>
      <h2 className="text-2xl font-bold text-ink-900">Sign in</h2>
      <p className="mt-1 text-sm text-slate-500">Use your organisation account.</p>
      <LoginForm />
    </AuthFrame>
  );
}
