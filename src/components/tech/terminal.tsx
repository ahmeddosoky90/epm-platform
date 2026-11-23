"use client";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { apiFetch } from "@/lib/client";

/** Browser SSH terminal: xterm.js ⇄ WebSocket (/ws/ssh) ⇄ ssh2 on the server. */
export function Terminal({ connectionId, onClose }: { connectionId: string; onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"connecting" | "open" | "closed">("connecting");
  useEffect(() => {
    let ws: WebSocket | null = null; let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed || !el.current) return;
      const term = new XTerm({ cursorBlink: true, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, theme: { background: "#1c1c1e", foreground: "#f2f2f7", cursor: "#0a84ff" } });
      const fit = new FitAddon(); term.loadAddon(fit); term.open(el.current); fit.fit(); term.focus();
      try {
        const { ticket } = await apiFetch<{ ticket: string }>(`/api/tech/connections/${connectionId}/ticket`, { method: "POST" });
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}/ws/ssh?ticket=${encodeURIComponent(ticket)}&cols=${term.cols}&rows=${term.rows}`);
        ws.binaryType = "arraybuffer";
        ws.onopen = () => setState("open");
        ws.onmessage = (e) => {
          if (typeof e.data === "string") { try { const m = JSON.parse(e.data); term.write(m.type === "error" ? `\r\n\x1b[31m${m.text}\x1b[0m\r\n` : m.text); } catch { term.write(e.data); } }
          else term.write(new Uint8Array(e.data));
        };
        ws.onclose = (e) => { setState("closed"); term.write(`\r\n\x1b[90m[Disconnected${e.reason ? `: ${e.reason}` : ""}]\x1b[0m\r\n`); };
        const d1 = term.onData((data) => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "data", data })));
        const onResize = () => { fit.fit(); if (ws?.readyState === 1) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); };
        window.addEventListener("resize", onResize);
        cleanup = () => { d1.dispose(); window.removeEventListener("resize", onResize); ws?.close(); term.dispose(); };
      } catch (e) { term.write(`\x1b[31m${(e as Error).message}\x1b[0m\r\n`); setState("closed"); cleanup = () => term.dispose(); }
    })();
    return () => { disposed = true; cleanup(); };
  }, [connectionId]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label="SSH terminal">
      <div className="w-full max-w-6xl rounded-xl overflow-hidden shadow-2xl bg-[#1c1c1e]">
        <div className="flex items-center gap-2 px-3 h-9 bg-[#2c2c2e] text-xs text-white/70">
          <button className="h-3 w-3 rounded-full bg-[#ff5f57]" onClick={onClose} aria-label="Close terminal" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ms-2">SSH · {state}</span><span className="ms-auto">Session is audited. Closes after 30 minutes idle.</span>
        </div>
        <div ref={el} className="h-[70vh] p-2" />
      </div>
    </div>
  );
}
