"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";

function ResetInner() {
  const token = useSearchParams().get("token") ?? ""; const router = useRouter();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState(false);
  return (
    <main className="min-h-screen flex items-center justify-center p-4"><div className="card p-6 w-full max-w-sm">
      <h1 className="h2 mb-4">Choose a new password</h1>
      {done ? <><p className="text-sm mb-4">Password updated. All your sessions were signed out.</p><button className="btn-primary w-full" onClick={() => router.push("/login")}>Sign in</button></> :
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setErr(null); if (pw !== pw2) return setErr("Passwords do not match"); try { await apiFetch("/api/auth/reset", { method: "PATCH", json: { token, password: pw } }); setDone(true); } catch (x) { setErr((x as Error).message); } }}>
        <input className="input" type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input className="input" type="password" placeholder="Repeat password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        <p className="text-xs muted">At least 10 characters with upper and lower case, a digit and a symbol.</p>
        {err && <p role="alert" className="text-sm text-[#ff3b30]">{err}</p>}
        <button className="btn-primary w-full">Update password</button>
      </form>}
    </div></main>
  );
}
export default function ResetPage() { return <Suspense><ResetInner /></Suspense>; }
