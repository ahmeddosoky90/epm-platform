"use client";
import { useEffect, useRef, useState } from "react";
import Guacamole from "guacamole-common-js";
import { apiFetch } from "@/lib/client";

/** In-browser RDP: guacamole-common-js ⇄ /ws/rdp ⇄ guacd ⇄ RDP server. */
export function RdpViewer({ connectionId, password, onClose }: { connectionId: string; password?: string; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState("connecting");
  useEffect(() => {
    let client: { disconnect: () => void } | null = null; let kb: { onkeydown: unknown; onkeyup: unknown } | null = null; let dead = false;
    (async () => {
      try {
        const { ticket } = await apiFetch<{ ticket: string }>(`/api/tech/connections/${connectionId}/ticket`, { method: "POST", json: password ? { password } : {} });
        if (dead || !host.current) return;
        const box = host.current.getBoundingClientRect();
        const c = new Guacamole.Client(new Guacamole.WebSocketTunnel("/ws/rdp"));
        client = c;
        const display = c.getDisplay().getElement();
        host.current.appendChild(display);
        c.onstatechange = (s: number) => setState(["idle", "connecting", "waiting", "connected", "disconnecting", "disconnected"][s] ?? String(s));
        c.onerror = (e: { message?: string }) => setState(`error: ${e.message ?? "connection failed"}`);
        const mouse = new Guacamole.Mouse(display);
        mouse.onEach(["mousedown", "mouseup", "mousemove"], (e: { state: unknown }) => c.sendMouseState(e.state, true));
        const k = new Guacamole.Keyboard(document);
        k.onkeydown = (sym: number) => { c.sendKeyEvent(1, sym); return false; };
        k.onkeyup = (sym: number) => c.sendKeyEvent(0, sym);
        kb = k;
        c.connect(`ticket=${encodeURIComponent(ticket)}&width=${Math.round(box.width)}&height=${Math.round(box.height)}&dpi=${Math.round(96 * window.devicePixelRatio)}`);
      } catch (e) { setState(`error: ${(e as Error).message}`); }
    })();
    return () => { dead = true; if (kb) { kb.onkeydown = null; kb.onkeyup = null; } client?.disconnect(); };
  }, [connectionId, password]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-label="Remote desktop">
      <div className="w-full max-w-[1400px] rounded-xl overflow-hidden shadow-2xl bg-black">
        <div className="flex items-center gap-2 px-3 h-9 bg-[#2c2c2e] text-xs text-white/70">
          <button className="h-3 w-3 rounded-full bg-[#ff5f57]" onClick={onClose} aria-label="Disconnect" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ms-2">RDP · {state}</span><span className="ms-auto">Keyboard and mouse go to the remote desktop. Session is audited.</span>
        </div>
        <div ref={host} className="h-[78vh] overflow-hidden bg-black" />
      </div>
    </div>
  );
}
