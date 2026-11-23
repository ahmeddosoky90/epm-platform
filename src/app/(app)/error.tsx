"use client";
import Link from "next/link";
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const denied = /permission|restricted|not allowed|forbidden|only the/i.test(error.message);
  return (
    <div className="card p-10 text-center max-w-xl mx-auto mt-10">
      <div className="font-semibold">{denied ? "You don't have access to this page" : "This page could not be loaded"}</div>
      <p className="text-sm muted mt-1">{denied ? "Your role does not include the permission this page needs. Ask a workspace administrator if you should have it." : "Please try again. If it keeps happening, give your administrator this reference: " + (error.digest ?? "n/a")}</p>
      <div className="flex justify-center gap-2 mt-4">{!denied && <button className="btn-secondary" onClick={reset}>Try again</button>}<Link className="btn-primary" href="/">Go home</Link></div>
    </div>
  );
}
