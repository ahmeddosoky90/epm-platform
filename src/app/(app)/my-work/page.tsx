import { Suspense } from "react";
import { requireCtx, can } from "@/lib/auth";
import { PageHeader } from "@/components/ui/bits";
import { IssueSearch } from "@/components/issues/issue-search";
export const metadata = { title: "My work" };
export default async function MyWork() {
  const ctx = await requireCtx();
  return (<><PageHeader title="My work" subtitle="Everything assigned to you that is not done, soonest due first." />
    <Suspense><IssueSearch initialJql="assignee = currentUser() AND statusCategory != Done ORDER BY dueDate ASC, priority DESC" canExport={can(ctx, "report:export")} /></Suspense></>);
}
