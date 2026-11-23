"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateIssueModal } from "./create-issue";
export function ProjectCreateButton({ projectId, label = "Create issue", defaults, onCreated }: { projectId: string; label?: string; defaults?: Record<string, unknown>; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button className="btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</button><CreateIssueModal open={open} onClose={() => setOpen(false)} projectId={projectId} defaults={defaults} onCreated={onCreated} /></>;
}
