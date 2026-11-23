"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "mfa" | "forgot" | "sent">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const router = useRouter(); const sp = useSearchParams();
  const next = sp.get("next")?.startsWith("/") ? sp.get("next")! : "/";
  const go = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  if (mode === "mfa") return (
    <form onSubmit={(e) => { e.preventDefault(); go(async () => { await apiFetch("/api/auth/mfa", { method: "POST", json: { code } }); router.replace(next); router.refresh(); }); }} className="space-y-4">
      <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" className="input text-center tracking-[0.4em] text-lg" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
      {err && <p role="alert" className="text-sm text-[#ff3b30]">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Verify</button>
    </form>
  );
  if (mode === "forgot" || mode === "sent") return (
    <form onSubmit={(e) => { e.preventDefault(); go(async () => { await apiFetch("/api/auth/reset", { method: "POST", json: { email } }); setMode("sent"); }); }} className="space-y-4">
      {mode === "sent" ? <p className="text-sm">If an account exists for <b>{email}</b>, a reset link has been sent. If email delivery is not set up in this installation, ask your administrator for a reset link.</p> : <>
        <div><label className="label" htmlFor="femail">Work email</label><input id="femail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        {err && <p role="alert" className="text-sm text-[#ff3b30]">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>Send reset link</button></>}
      <button type="button" className="btn-ghost w-full" onClick={() => setMode("login")}>Back to sign in</button>
    </form>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(async () => { const r = await apiFetch<{ mfaRequired: boolean }>("/api/auth/login", { method: "POST", json: { email, password } }); if (r.mfaRequired) setMode("mfa"); else { router.replace(next); router.refresh(); } }); }} className="space-y-4">
      <div><label className="label" htmlFor="email">Work email</label><input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {err && <p role="alert" className="text-sm text-[#ff3b30]">{err}</p>}
      <button className="btn-primary w-full h-10" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <button type="button" className="btn-ghost w-full" onClick={() => setMode("forgot")}>Forgot password?</button>
    </form>
  );
}
