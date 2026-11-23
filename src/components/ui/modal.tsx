"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, wide, dirty }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; dirty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => { if (dirty && !window.confirm("Discard unsaved changes?")) return; onClose(); };
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 pt-[8vh] overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`card shadow-pop w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-0`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="h2">{title}</h2>
          <button className="btn-secondary btn-sm !px-2" aria-label="Close" onClick={close}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, onCancel, onConfirm, danger, busy }: { open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-2 mb-5">{body}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={danger ? "btn-danger" : "btn-primary"} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : "Confirm"}</button>
      </div>
    </Modal>
  );
}
