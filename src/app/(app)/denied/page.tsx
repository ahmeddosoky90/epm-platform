import Link from "next/link";
import { PERMISSIONS } from "@/lib/rbac/permissions";
export default async function Denied({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const need = (await searchParams).need as keyof typeof PERMISSIONS | undefined;
  return <div className="card p-10 text-center max-w-xl mx-auto mt-10"><div className="font-semibold">You don&apos;t have access to this page</div>
    <p className="text-sm muted mt-1">{need && PERMISSIONS[need] ? `It needs the “${PERMISSIONS[need]}” permission, which your role does not include.` : "Your role does not include the permission this page needs."} Ask a workspace administrator if you should have it.</p>
    <Link className="btn-primary mt-4 inline-flex" href="/">Go home</Link></div>;
}
