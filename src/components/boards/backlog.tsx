"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, CheckCircle2, Plus } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Chip, Avatar, Priority } from "@/components/ui/bits";
import { ProjectCreateButton } from "@/components/issues/project-create-button";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function Backlog({ data, canManage, canEdit }: { data: any; canManage: boolean; canEdit: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [issues, setIssues] = useState<any[]>(data.issues);
  const [epic, setEpic] = useState(""); const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { kind: "start" | "complete" | "new"; sprint?: any }>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const visible = (i: any) => (!epic || i.parent?.key === epic) && (!q || `${i.key} ${i.summary}`.toLowerCase().includes(q.toLowerCase()));
  const containers = [...data.sprints.map((s: any) => ({ id: s.id, sprint: s })), { id: "backlog", sprint: null }];
  const listOf = (cid: string) => issues.filter((i) => (i.sprintId ?? "backlog") === cid);

  const onDragEnd = async (e: DragEndEvent) => {
    const a = issues.find((i) => i.key === e.active.id); if (!a || !e.over) return;
    const overIssue = issues.find((i) => i.key === e.over!.id);
    const target = overIssue ? (overIssue.sprintId ?? "backlog") : String(e.over.id);
    const from = a.sprintId ?? "backlog";
    if (target !== from) {
      setIssues(issues.map((i) => i.key === a.key ? { ...i, sprintId: target === "backlog" ? null : target } : i));
      try { await apiFetch(`/api/issues/${a.key}`, { method: "PATCH", json: { sprintId: target === "backlog" ? null : target } }); toast.ok(`${a.key} moved to ${target === "backlog" ? "backlog" : data.sprints.find((s: any) => s.id === target)?.name}`); }
      catch (x) { toast.err(x); setIssues(issues); }
      return;
    }
    if (!overIssue || a.key === overIssue.key) return;
    const list = listOf(from); const oldI = list.findIndex((i) => i.key === a.key), newI = list.findIndex((i) => i.key === overIssue.key);
    const reordered = arrayMove(list, oldI, newI);
    setIssues([...issues.filter((i) => (i.sprintId ?? "backlog") !== from), ...reordered]);
    try { await apiFetch(`/api/projects/${data.project.id}/rank`, { method: "POST", json: { keys: reordered.map((i) => i.key) } }); } catch (x) { toast.err(x); }
  };
  const pts = (l: any[]) => l.reduce((s, i) => s + Number(i.storyPoints ?? 0), 0);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input className="input !h-8 !w-56" placeholder="Search backlog" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !h-8 !w-64" value={epic} onChange={(e) => setEpic(e.target.value)}><option value="">All epics</option>{data.epics.map((e: any) => <option key={e.id} value={e.key}>{e.key} · {e.summary}</option>)}</select>
        <span className="flex-1" />
        {canManage && <button className="btn-secondary btn-sm" onClick={() => setModal({ kind: "new" })}><Plus className="h-4 w-4" />Create sprint</button>}
        {canEdit && <ProjectCreateButton projectId={data.project.id} onCreated={() => router.refresh()} />}
      </div>
      <p className="text-xs muted mb-3">Drag issues to reorder by priority, or drop them on a sprint to plan it.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={canEdit ? onDragEnd : undefined}>
        <div className="space-y-4">
          {containers.map((c) => { const list = listOf(c.id); const shown = list.filter(visible); const s = c.sprint;
            const cap = s?.capacityPoints ? Number(s.capacityPoints) : null; const total = pts(list);
            return (
              <Container key={c.id} id={c.id}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line flex-wrap">
                  <div className="flex-1 min-w-0"><div className="font-semibold text-sm flex items-center gap-2">{s ? s.name : "Backlog"}{s && <Chip color={s.state === "ACTIVE" ? "#34c759" : "#8e8e93"}>{s.state}</Chip>}</div>
                    {s && <div className="text-xs muted">{s.goal ?? "No goal set"}{s.startDate && ` · ${s.startDate.slice(0, 10)} → ${s.endDate?.slice(0, 10)}`}</div>}</div>
                  <span className="text-xs muted">{list.length} issues · {total} pts{cap != null && <> / capacity {cap}{total > cap && <span className="text-[#ff3b30]"> · over capacity</span>}</>}</span>
                  {canManage && s?.state === "FUTURE" && <button className="btn-primary btn-sm" disabled={!!data.sprints.find((x: any) => x.state === "ACTIVE")} title={data.sprints.find((x: any) => x.state === "ACTIVE") ? "Complete the active sprint first" : ""} onClick={() => setModal({ kind: "start", sprint: s })}><Play className="h-3.5 w-3.5" />Start sprint</button>}
                  {canManage && s?.state === "ACTIVE" && <button className="btn-primary btn-sm" onClick={() => setModal({ kind: "complete", sprint: s })}><CheckCircle2 className="h-3.5 w-3.5" />Complete sprint</button>}
                </div>
                <SortableContext items={shown.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                  <div className="min-h-[44px]">{shown.length === 0 && <div className="text-xs muted px-4 py-3">Drop issues here</div>}{shown.map((i) => <Row key={i.key} i={i} draggable={canEdit} />)}</div>
                </SortableContext>
              </Container>);
          })}
        </div>
      </DndContext>
      <SprintModals modal={modal} close={() => setModal(null)} data={data} issues={issues} onDone={() => { setModal(null); router.refresh(); }} />
    </div>
  );
}

function Container({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <section ref={setNodeRef} className={`card overflow-hidden ${isOver ? "ring-2 ring-accent/40" : ""}`}>{children}</section>;
}
function Row({ i, draggable }: { i: any; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: i.key, disabled: !draggable });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-3 px-4 py-2 border-b border-line last:border-0 text-sm bg-surface ${isDragging ? "opacity-50 relative z-10 shadow-pop" : ""}`}>
      {draggable && <button {...attributes} {...listeners} aria-label={`Reorder ${i.key}`} className="cursor-grab muted"><GripVertical className="h-4 w-4" /></button>}
      <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: i.type.color }} title={i.type.name} />
      <Link href={`/issues/${i.key}`} className="text-accent font-medium w-20 shrink-0">{i.key}</Link>
      <span className="flex-1 truncate">{i.summary}</span>
      {i.parent && <Chip color="#af52de">{i.parent.summary.slice(0, 22)}</Chip>}
      <Chip color={i.status.color}>{i.status.name}</Chip>
      <Priority p={i.priority} />
      <span className="chip bg-black/5 text-ink-2 w-8 justify-center">{i.storyPoints != null ? Number(i.storyPoints) : "–"}</span>
      <Avatar name={i.assignee?.name} size={22} />
    </div>
  );
}

function SprintModals({ modal, close, data, issues, onDone }: { modal: any; close: () => void; data: any; issues: any[]; onDone: () => void }) {
  const toast = useToast(); const today = new Date().toISOString().slice(0, 10); const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState<Record<string, string>>({});
  const s = modal?.sprint;
  const go = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast.ok(msg); setF({}); onDone(); } catch (e) { toast.err(e); } };
  if (!modal) return null;
  if (modal.kind === "new") return <Modal open onClose={close} title="Create sprint"><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(() => apiFetch(`/api/projects/${data.project.id}/sprints`, { method: "POST", json: { name: f.name || undefined, goal: f.goal || undefined, capacityPoints: f.cap ? Number(f.cap) : undefined } }), "Sprint created"); }}>
    <div><label className="label">Name</label><input className="input" placeholder="Auto-named if blank" value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
    <div><label className="label">Goal</label><input className="input" value={f.goal ?? ""} onChange={(e) => setF({ ...f, goal: e.target.value })} /></div>
    <div><label className="label">Capacity (story points)</label><input type="number" min={0} className="input" value={f.cap ?? ""} onChange={(e) => setF({ ...f, cap: e.target.value })} /></div>
    <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button className="btn-primary">Create</button></div></form></Modal>;
  if (modal.kind === "start") { const inSprint = issues.filter((i) => i.sprintId === s.id);
    return <Modal open onClose={close} title={`Start ${s.name}`}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(() => apiFetch(`/api/sprints/${s.id}`, { method: "PATCH", json: { action: "start", startDate: f.start ?? today, endDate: f.end ?? twoWeeks, goal: f.goal ?? s.goal ?? undefined } }), "Sprint started"); }}>
      <p className="text-sm">{inSprint.length} issues · {inSprint.reduce((a, i) => a + Number(i.storyPoints ?? 0), 0)} story points committed.</p>
      <div className="grid grid-cols-2 gap-3"><div><label className="label">Start</label><input type="date" className="input" value={f.start ?? today} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label">End</label><input type="date" className="input" value={f.end ?? twoWeeks} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div>
      <div><label className="label">Sprint goal</label><input className="input" value={f.goal ?? s.goal ?? ""} onChange={(e) => setF({ ...f, goal: e.target.value })} /></div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button className="btn-primary">Start</button></div></form></Modal>; }
  const open = issues.filter((i) => i.sprintId === s.id && i.status.category !== "DONE"); const futures = data.sprints.filter((x: any) => x.state === "FUTURE");
  return <Modal open onClose={close} title={`Complete ${s.name}`}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(() => apiFetch(`/api/sprints/${s.id}`, { method: "PATCH", json: { action: "complete", moveTo: f.moveTo || null } }), "Sprint completed"); }}>
    <p className="text-sm">{issues.filter((i) => i.sprintId === s.id).length - open.length} issues done, {open.length} incomplete.</p>
    {open.length > 0 && <div><label className="label">Move incomplete issues to</label><select className="input" value={f.moveTo ?? ""} onChange={(e) => setF({ ...f, moveTo: e.target.value })}><option value="">Backlog</option>{futures.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}
    <div className="flex justify-between gap-2"><button type="button" className="btn-ghost text-[#ff3b30]" onClick={() => go(() => apiFetch(`/api/sprints/${s.id}`, { method: "PATCH", json: { action: "cancel", moveTo: f.moveTo || null } }), "Sprint cancelled")}>Cancel sprint</button><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={close}>Close</button><button className="btn-primary">Complete</button></div></div></form></Modal>;
}
