import { Suspense } from "react";
import { requireCtx, can } from "@/lib/auth";
import { loadProject } from "@/lib/services/access";
import { IssueSearch } from "@/components/issues/issue-search";
import { ProjectCreateButton } from "@/components/issues/project-create-button";

export default async function ProjectIssues({ params }: { params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const p = await loadProject(ctx, (await params).key);
  return (<>
    {can(ctx, "issue:create") && !p.archivedAt && <div className="flex justify-end mb-3"><ProjectCreateButton projectId={p.id} /></div>}
    <Suspense><IssueSearch lockedPrefix={`project = ${p.key}`} initialJql="ORDER BY key DESC" showFilters={false} canExport={can(ctx, "report:export")} /></Suspense>
  </>);
}
