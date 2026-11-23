"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

export function ProfileForm({ user }: { user: { name: string; jobTitle: string | null; locale: string; email: string } }) {
  const [f, setF] = useState({ name: user.name, jobTitle: user.jobTitle ?? "", locale: user.locale });
  const toast = useToast(); const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch("/api/me", { method: "PATCH", json: { ...f, jobTitle: f.jobTitle || null } }); document.cookie = `epm_lang=${f.locale}; path=/; max-age=31536000; samesite=lax`; toast.ok("Profile saved"); router.refresh(); } catch (x) { toast.err(x); } }}>
      <div><label className="label">Email</label><input className="input" value={user.email} disabled /></div>
      <div><label className="label">Name</label><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Job title</label><input className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></div>
      <div><label className="label">Language</label><select className="input" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}><option value="en">English</option><option value="ar">العربية (right-to-left)</option></select></div>
      <button className="btn-primary">Save</button>
    </form>
  );
}

export function PasswordForm() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const toast = useToast();
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (f.next !== f.confirm) { toast.err(new Error("The new passwords do not match")); return; }
      try { await apiFetch("/api/auth/password", { method: "PUT", json: { current: f.current, next: f.next } }); toast.ok("Password changed. Other sessions were signed out."); setF({ current: "", next: "", confirm: "" }); } catch (x) { toast.err(x); }
    }}>
      <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
      <div><label className="label">New password</label><input className="input" type="password" autoComplete="new-password" required minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></div>
      <div><label className="label">Confirm new password</label><input className="input" type="password" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></div>
      <p className="text-xs muted">At least 10 characters with upper and lower case letters, a digit and a symbol.</p>
      <button className="btn-primary">Change password</button>
    </form>
  );
}

export function MfaPanel({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null); const [code, setCode] = useState("");
  const toast = useToast(); const router = useRouter();
  if (enabled) return (<div className="space-y-3"><p className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#34c759]" />Two-step verification is on. You will be asked for a 6-digit code from your authenticator app at sign-in.</p>
    <button className="btn-secondary" onClick={async () => { try { await apiFetch("/api/auth/mfa", { method: "DELETE" }); toast.ok("Two-step verification turned off"); router.refresh(); } catch (x) { toast.err(x); } }}>Turn off</button></div>);
  return (<div className="space-y-3">
    <p className="text-sm">Protect your account with a time-based code from an authenticator app (Microsoft Authenticator, Google Authenticator, 1Password…).</p>
    {!setup ? <button className="btn-primary" onClick={async () => { try { const r = await apiFetch<{ secret: string; uri: string }>("/api/auth/mfa", { method: "PUT" }); setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 180 }) }); } catch (x) { toast.err(x); } }}>Set up</button> : (
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await apiFetch("/api/auth/mfa", { method: "PATCH", json: { code } }); toast.ok("Two-step verification is on"); setSetup(null); router.refresh(); } catch (x) { toast.err(x); } }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="QR code to scan with your authenticator app" width={180} height={180} className="rounded-lg bg-white p-1" />
        <p className="text-xs muted">Or enter this key manually: <code className="select-all">{setup.secret}</code></p>
        <div><label className="label">6-digit code</label><input className="input !w-40 tracking-widest" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
        <button className="btn-primary">Verify and turn on</button>
      </form>)}
  </div>);
}

export function RevokeSessions({ others }: { others: number }) {
  const toast = useToast(); const router = useRouter();
  return <button className="btn-secondary" disabled={!others} onClick={async () => { try { const r = await apiFetch<{ revoked: number }>("/api/me", { method: "DELETE" }); toast.ok(`Signed out ${r.revoked} other session(s)`); router.refresh(); } catch (x) { toast.err(x); } }}>Sign out other sessions ({others})</button>;
}
