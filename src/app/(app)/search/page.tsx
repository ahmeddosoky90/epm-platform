import Link from "next/link";
import { Suspense } from "react";
import { requireCtx, can } from "@/lib/auth";
import { quickSearch } from "@/lib/services/search";
import { PageHeader, Card, Chip } from "@/components/ui/bits";
import { IssueSearch } from "@/components/issues/issue-search";

export const metadata = { title: "Issues & search" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; jql?: string }> }) {
  const ctx = await requireCtx(); const { q } = await searchParams;
  const quick = q ? await quickSearch(ctx, q) : null;
  return (
    <>
      <PageHeader title={q ? `Results for “${q}”` : "Issues & filters"} subtitle="Query issues with EQL, save and share filters, export results." />
      {quick && <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card title={`Projects (${quick.projects.length})`}>{quick.projects.map((p) => <Link key={p.id} href={`/projects/${p.key}`} className="block text-sm py-1 text-accent">{p.name} ({p.key})</Link>)}</Card>
        <Card title={`People (${quick.users.length})`}>{quick.users.map((u) => <div key={u.id} className="text-sm py-1">{u.name} <span className="muted text-xs">{u.jobTitle}</span></div>)}</Card>
        <Card title="Portfolios, programs, risks, milestones, documents">
          {quick.portfolios.map((p) => <Link key={p.id} href={`/portfolios/${p.id}`} className="block text-sm py-0.5 text-accent">Portfolio · {p.name}</Link>)}
          {quick.programs.map((p) => <div key={p.id} className="text-sm py-0.5">Program · {p.name}</div>)}
          {quick.risks.map((r) => <Link key={r.id} href={`/projects/${r.project.key}/raid`} className="block text-sm py-0.5">Risk · {r.project.key} · {r.title}</Link>)}
          {quick.milestones.map((m) => <Link key={m.id} href={`/projects/${m.project.key}/plan`} className="block text-sm py-0.5">Milestone · {m.project.key} · {m.name}</Link>)}
          {quick.documents.map((d) => <Link key={d.id} href={`/projects/${d.project.key}/documents`} className="block text-sm py-0.5">Document · {d.title}</Link>)}
        </Card>
      </div>}
      {quick && quick.issues.length > 0 && <Card title="Matching issues" className="mb-6">{quick.issues.map((i) => <div key={i.id} className="flex gap-2 items-center text-sm py-1"><Link className="text-accent font-medium" href={`/issues/${i.key}`}>{i.key}</Link><span className="flex-1 truncate">{i.summary}</span><Chip color={i.status.color}>{i.status.name}</Chip></div>)}</Card>}
      <Suspense><IssueSearch initialJql={q ? `text ~ "${q.replace(/"/g, "")}"` : "statusCategory != Done ORDER BY updated DESC"} canExport={can(ctx, "report:export")} /></Suspense>
    </>
  );
}
