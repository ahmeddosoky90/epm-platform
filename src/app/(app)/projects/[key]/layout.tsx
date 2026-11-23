import { notFound } from "next/navigation";
import { requireCtx, can } from "@/lib/auth";
import { loadProject, canManageProject } from "@/lib/services/access";
import { AppError } from "@/lib/errors";
import { Health, Chip, STATUS_LABEL } from "@/components/ui/bits";
import { ProjectTabs } from "@/components/projects/tabs";
import { prisma } from "@/lib/db";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const ctx = await requireCtx(); const { key } = await params;
  let p;
  try { p = await loadProject(ctx, key); } catch (e) { if (e instanceof AppError && e.status === 404) notFound(); throw e; }
  const stage = p.lifecycleStageId ? await prisma.lifecycleStage.findUnique({ where: { id: p.lifecycleStageId } }) : null;
  const tabs = [
    { href: "", label: "Overview" }, { href: "/issues", label: "Issues" }, { href: "/board", label: "Board" },
    ...(p.methodology !== "WATERFALL" ? [{ href: "/backlog", label: "Backlog & sprints" }] : []),
    { href: "/plan", label: "Schedule" }, { href: "/raid", label: "RAID" },
    ...(can(ctx, "finance:view") || canManageProject(ctx, p) ? [{ href: "/finance", label: "Budget" }] : []),
    { href: "/governance", label: "Governance" }, { href: "/changes", label: "Changes" }, { href: "/documents", label: "Documents" },
    { href: "/reports", label: "Reports" }, { href: "/team", label: "Team" },
  ];
  return (
    <>
      <div className="mb-4">
        <nav className="text-xs muted mb-2"><a href="/projects" className="hover:text-ink-1">Projects</a> / {p.key}</nav>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="h1">{p.name}</h1>
          <Chip color="#8e8e93">{p.key}</Chip><Health h={p.health} /><Chip color="#0a84ff">{STATUS_LABEL[p.status] ?? p.status}</Chip>
          {stage && <Chip color="#5856d6">{stage.name}</Chip>}
          {p.archivedAt && <Chip color="#ff9f0a">Archived · read-only</Chip>}
        </div>
      </div>
      <ProjectTabs base={`/projects/${p.key}`} tabs={tabs} />
      <div className="mt-5">{children}</div>
    </>
  );
}
