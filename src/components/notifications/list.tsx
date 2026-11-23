"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };
export function NotificationList({ items }: { items: N[] }) {
  const toast = useToast(); const router = useRouter();
  const mark = async (json: unknown) => { try { await apiFetch("/api/notifications", { method: "PATCH", json }); router.refresh(); } catch (e) { toast.err(e); } };
  const unread = items.filter((n) => !n.readAt).length;
  return (<>
    <div className="flex justify-end mb-3"><button className="btn-secondary btn-sm" disabled={!unread} onClick={() => mark({ all: true })}>Mark all read ({unread})</button></div>
    {!items.length ? <div className="card p-10 text-center text-sm muted">You have no notifications.</div> : (
      <ul className="card divide-y divide-line overflow-hidden">{items.map((n) => (
        <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? "" : "bg-accent/5"}`}>
          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-accent"}`} aria-hidden />
          <div className="flex-1 min-w-0">
            {n.link ? <Link href={n.link} className="text-sm font-medium hover:underline" onClick={() => !n.readAt && mark({ ids: [n.id] })}>{n.title}</Link> : <div className="text-sm font-medium">{n.title}</div>}
            {n.body && <div className="text-sm muted line-clamp-2">{n.body}</div>}
            <div className="text-[11px] muted mt-0.5">{n.kind.replace(".", " · ")} · {new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo" })}</div>
          </div>
          <button className="btn-ghost btn-sm shrink-0" onClick={() => mark({ ids: [n.id], unread: !n.readAt ? undefined : true })}>{n.readAt ? "Mark unread" : "Mark read"}</button>
        </li>))}</ul>)}
  </>);
}
