import Link from "next/link";
export default function NotFound() {
  return <div className="card p-10 text-center max-w-xl mx-auto mt-10"><div className="font-semibold">Not found</div><p className="text-sm muted mt-1">It does not exist, or you do not have access to it.</p><Link className="btn-primary mt-4 inline-flex" href="/">Go home</Link></div>;
}
