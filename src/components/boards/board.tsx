"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable, useDraggable, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { Settings2, AlertOctagon, Clock } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Avatar, Chip, PRIORITY_COLOR } from "@/components/ui/bits";
import { Modal } from "@/components/ui/modal";
import { ProjectCreateButton } from "@/components/issues/project-create-button";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Card = any;
type Data = { board: { id: string; name: string; kind: string; swimlane: string; projectId: string; columns: { id: string; name: string; wipLimit: number | null; statusIds: string[] }[] }; activeSprint: { name: string; goal: string | null; endDate: string } | null; issues: Card[] };

export function BoardView({ boardId, meId, canManage, canCreate, statuses }: { boardId: string; meId: string; canManage: boolean; canCreate: boolean; statuses: { id: string; name: string }[] }) {
  const [d, setD] = useState<Data | null>(null); const toast = useToast();
  const [qf, setQf] = useState<Set<string>>(new Set()); const [text, setText] = useState("");
  const [layout, setLayout] = useState({ points: true, due: true, epic: true });
  const [dragging, setDragging] = useState<Card | null>(null); const [config, setConfig] = useState(false);
  const load = useCallback(() => apiFetch<Data>(`/api/boards/${boardId}`).then(setD).catch(toast.err), [boardId, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { const s = localStorage.getItem("epm_cardlayout"); if (s) setLayout(JSON.parse(s)); } catch {} }, []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const filtered = useMemo(() => (d?.issues ?? []).filter((i) => (!qf.has("mine") || i.assigneeId === meId) && (!qf.has("blocked") || i.blocked) && (!qf.has("stoppers") || i.isShowStopper) && (!qf.has("bugs") || i.type.name === "Bug") && (!qf.has("overdue") || (i.dueDate && new Date(i.dueDate) < new Date() && i.status.category !== "DONE")) && (!text || `${i.key} ${i.summary}`.toLowerCase().includes(text.toLowerCase()))), [d, qf, meId, text]);
  if (!d) return <div className="muted text-sm">Loading board…</div>;
  const lanes: { key: string; label: string }[] = d.board.swimlane === "NONE" ? [{ key: "_", label: "" }]
    : [...new Map(filtered.map((i) => { const k = d.board.swimlane === "ASSIGNEE" ? i.assignee?.name ?? "Unassigned" : d.board.swimlane === "EPIC" ? (i.parent ? `${i.parent.key} ${i.parent.summary}` : "No epic") : i.priority; return [k, { key: k, label: k }]; })).values()].sort((a, b) => a.label.localeCompare(b.label));
  const laneOf = (i: Card) => d.board.swimlane === "NONE" ? "_" : d.board.swimlane === "ASSIGNEE" ? i.assignee?.name ?? "Unassigned" : d.board.swimlane === "EPIC" ? (i.parent ? `${i.parent.key} ${i.parent.summary}` : "No epic") : i.priority;

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const issue = d.issues.find((i) => i.key === e.active.id); const colId = (e.over?.id as string | undefined)?.split("|")[0];
    if (!issue || !colId) return;
    const col = d.board.columns.find((c) => c.id === colId)!;
    if (col.statusIds.includes(issue.statusId)) return;
    // optimistic
    const prev = d; setD({ ...d, issues: d.issues.map((i) => i.key === issue.key ? { ...i, statusId: col.statusIds[0], status: { ...i.status, name: "…" } } : i) });
    try { await apiFetch(`/api/boards/${boardId}/move`, { method: "POST", json: { issueKey: issue.key, columnId: colId } }); toast.ok(`${issue.key} → ${col.name}`); }
    catch (x) { setD(prev); toast.err(x); }
    load();
  };
  const toggle = (k: string) => { const s = new Set(qf); if (s.has(k)) s.delete(k); else s.add(k); setQf(s); };
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {d.activeSprint && <div className="me-4"><div className="text-sm font-semibold">{d.activeSprint.name}</div><div className="text-xs muted">{d.activeSprint.goal} · ends {d.activeSprint.endDate?.slice(0, 10)}</div></div>}
        {d.board.kind === "SCRUM" && !d.activeSprint && <div className="text-sm muted me-4">No active sprint — start one from the backlog.</div>}
        <input className="input !h-8 !w-48" placeholder="Filter cards" value={text} onChange={(e) => setText(e.target.value)} aria-label="Filter cards" />
        {[["mine", "Only my issues"], ["blocked", "Blocked"], ["stoppers", "Show-stoppers"], ["bugs", "Bugs"], ["overdue", "Overdue"]].map(([k, l]) => <button key={k} className={clsx("chip h-7 px-3 text-xs", qf.has(k) ? "bg-accent text-white" : "bg-black/5 text-ink-2")} onClick={() => toggle(k)} aria-pressed={qf.has(k)}>{l}</button>)}
        <span className="flex-1" />
        <details className="relative"><summary className="btn-secondary btn-sm list-none cursor-pointer">Card layout</summary>
          <div className="absolute end-0 mt-1 card shadow-pop p-3 z-20 text-sm space-y-1 w-44">{(["points", "due", "epic"] as const).map((k) => <label key={k} className="flex gap-2"><input type="checkbox" checked={layout[k]} onChange={(e) => { const l = { ...layout, [k]: e.target.checked }; setLayout(l); try { localStorage.setItem("epm_cardlayout", JSON.stringify(l)); } catch {} }} />{k === "points" ? "Story points" : k === "due" ? "Due date" : "Epic"}</label>)}</div></details>
        {canManage && <button className="btn-secondary btn-sm" onClick={() => setConfig(true)}><Settings2 className="h-4 w-4" />Configure</button>}
        {canCreate && <ProjectCreateButton projectId={d.board.projectId} onCreated={load} />}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setDragging(d.issues.find((i) => i.key === e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="overflow-x-auto pb-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${d.board.columns.length}, minmax(240px, 1fr))` }}>
            {d.board.columns.map((c) => { const n = filtered.filter((i) => c.statusIds.includes(i.statusId)).length; const over = c.wipLimit != null && n > c.wipLimit;
              return <div key={c.id} className={clsx("rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide flex justify-between", over ? "bg-[#ff3b30]/15 text-[#ff3b30]" : "bg-black/[0.04] text-ink-2")}><span>{c.name}</span><span>{n}{c.wipLimit != null && ` / ${c.wipLimit}`}{over && " · WIP exceeded"}</span></div>; })}
          </div>
          {lanes.map((lane) => (
            <div key={lane.key}>
              {lane.label && <div className="text-xs font-semibold mt-4 mb-2 px-1">{lane.label} <span className="muted font-normal">({filtered.filter((i) => laneOf(i) === lane.key).length})</span></div>}
              <div className="grid gap-3 mt-2" style={{ gridTemplateColumns: `repeat(${d.board.columns.length}, minmax(240px, 1fr))` }}>
                {d.board.columns.map((c) => <Column key={c.id} id={`${c.id}|${lane.key}`} cards={filtered.filter((i) => c.statusIds.includes(i.statusId) && laneOf(i) === lane.key)} layout={layout} />)}
              </div>
            </div>))}
        </div>
        <DragOverlay>{dragging && <CardBox i={dragging} layout={layout} overlay />}</DragOverlay>
      </DndContext>
      {canManage && <BoardConfig open={config} onClose={() => setConfig(false)} data={d} statuses={statuses} onSaved={load} />}
    </div>
  );
}

function Column({ id, cards, layout }: { id: string; cards: Card[]; layout: Record<string, boolean> }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={clsx("rounded-xl p-2 min-h-[120px] space-y-2 transition", isOver ? "bg-accent/10 ring-2 ring-accent/40" : "bg-black/[0.025] dark:bg-white/[0.03]")}>{cards.map((i) => <Draggable key={i.key} i={i} layout={layout} />)}</div>;
}
function Draggable({ i, layout }: { i: Card; layout: Record<string, boolean> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: i.key });
  return <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-30" : ""}><CardBox i={i} layout={layout} /></div>;
}
function CardBox({ i, layout, overlay }: { i: Card; layout: Record<string, boolean>; overlay?: boolean }) {
  const overdue = i.dueDate && new Date(i.dueDate) < new Date() && i.status.category !== "DONE";
  return (
    <div className={clsx("card p-3 text-sm cursor-grab active:cursor-grabbing", overlay && "shadow-pop rotate-1", i.blocked && "!border-[#ff3b30]/60", i.isShowStopper && "ring-2 ring-[#ff3b30]/60")}>
      <div className="flex items-start gap-2"><span className="flex-1 leading-snug">{i.summary}</span></div>
      {layout.epic && i.parent && <div className="mt-2"><Chip color="#af52de">{i.parent.summary.slice(0, 28)}</Chip></div>}
      <div className="flex items-center gap-2 mt-2.5 text-xs">
        <span className="h-3 w-3 rounded-sm" style={{ background: i.type.color }} title={i.type.name} />
        <Link href={`/issues/${i.key}`} className="muted hover:text-accent font-medium" onPointerDown={(e) => e.stopPropagation()}>{i.key}</Link>
        {i.blocked && <span title="Blocked" className="text-[#ff3b30] flex items-center gap-0.5"><AlertOctagon className="h-3.5 w-3.5" />Blocked</span>}
        {layout.due && overdue && <span className="text-[#ff3b30] flex items-center gap-0.5" title="Overdue"><Clock className="h-3.5 w-3.5" />{i.dueDate.slice(5, 10)}</span>}
        <span className="flex-1" />
        <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLOR[i.priority] }} title={i.priority} />
        {layout.points && i.storyPoints != null && <span className="chip bg-black/5 text-ink-2">{Number(i.storyPoints)}</span>}
        <Avatar name={i.assignee?.name} size={20} />
      </div>
    </div>
  );
}

function BoardConfig({ open, onClose, data, statuses, onSaved }: { open: boolean; onClose: () => void; data: Data; statuses: { id: string; name: string }[]; onSaved: () => void }) {
  const [cols, setCols] = useState(data.board.columns.map((c) => ({ ...c })));
  const [lane, setLane] = useState(data.board.swimlane); const toast = useToast();
  useEffect(() => { setCols(data.board.columns.map((c) => ({ ...c }))); setLane(data.board.swimlane); }, [data, open]);
  const mapped = new Set(cols.flatMap((c) => c.statusIds));
  return <Modal open={open} onClose={onClose} title="Configure board" wide>
    <div className="space-y-4">
      <div><label className="label">Swimlanes</label><select className="input !w-60" value={lane} onChange={(e) => setLane(e.target.value)}><option value="NONE">None</option><option value="ASSIGNEE">By assignee</option><option value="EPIC">By epic</option><option value="PRIORITY">By priority</option></select></div>
      <div className="space-y-2">{cols.map((c, idx) => <div key={idx} className="card p-3 flex gap-3 items-start">
        <input className="input !w-40" value={c.name} onChange={(e) => setCols(cols.map((x, j) => j === idx ? { ...x, name: e.target.value } : x))} aria-label="Column name" />
        <input className="input !w-24" type="number" min={1} placeholder="WIP" value={c.wipLimit ?? ""} onChange={(e) => setCols(cols.map((x, j) => j === idx ? { ...x, wipLimit: e.target.value ? Number(e.target.value) : null } : x))} aria-label="WIP limit" />
        <div className="flex flex-wrap gap-1 flex-1">{statuses.map((s) => { const on = c.statusIds.includes(s.id); const elsewhere = !on && mapped.has(s.id);
          return <button key={s.id} disabled={elsewhere} className={clsx("chip h-6 px-2", on ? "bg-accent text-white" : elsewhere ? "bg-black/5 text-ink-3 line-through" : "bg-black/5 text-ink-2")} onClick={() => setCols(cols.map((x, j) => j === idx ? { ...x, statusIds: on ? x.statusIds.filter((y) => y !== s.id) : [...x.statusIds, s.id] } : x))}>{s.name}</button>; })}</div>
        <button className="btn-ghost btn-sm" disabled={idx === 0} onClick={() => { const n = [...cols]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; setCols(n); }} aria-label="Move left">←</button>
        <button className="btn-ghost btn-sm text-[#ff3b30]" onClick={() => setCols(cols.filter((_, j) => j !== idx))} aria-label="Remove column">✕</button>
      </div>)}</div>
      <button className="btn-secondary btn-sm" onClick={() => setCols([...cols, { id: undefined as unknown as string, name: "New column", wipLimit: null, statusIds: [] }])}>Add column</button>
      {statuses.some((s) => !mapped.has(s.id)) && <p className="text-xs text-[#ff9f0a]">Unmapped statuses (issues in these won’t appear): {statuses.filter((s) => !mapped.has(s.id)).map((s) => s.name).join(", ")}</p>}
      <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={async () => { try { await apiFetch(`/api/boards/${data.board.id}`, { method: "PATCH", json: { swimlane: lane, columns: cols.map((c) => ({ id: c.id, name: c.name, wipLimit: c.wipLimit, statusIds: c.statusIds })) } }); toast.ok("Board saved"); onClose(); onSaved(); } catch (e) { toast.err(e); } }}>Save</button></div>
    </div>
  </Modal>;
}
