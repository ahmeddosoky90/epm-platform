import { Suspense } from "react";
import { LoginForm } from "./form";
import { Logo } from "@/components/shell/logo";
export const metadata = { title: "Sign in" };
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden isolate">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "radial-gradient(1200px 600px at 10% -10%, rgba(90,200,250,.35), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(88,86,214,.30), transparent 60%)" }} />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} />
          <h1 className="text-3xl font-semibold tracking-tight mt-4">Lumen PMO</h1>
          <p className="muted text-sm mt-1">Projects, portfolios and delivery — in one place.</p>
        </div>
        <div className="glass card p-6 shadow-pop"><Suspense><LoginForm /></Suspense></div>
        <p className="text-center text-xs muted mt-6">Access is restricted to authorised users. Activity is audited.</p>
      </div>
    </main>
  );
}
