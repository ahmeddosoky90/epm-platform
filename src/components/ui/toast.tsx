"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; kind: "ok" | "err"; text: string };
const Ctx = createContext<{ ok: (t: string) => void; err: (t: unknown) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);
  const ok = useCallback((t: string) => push("ok", t), [push]);
  const err = useCallback((e: unknown) => push("err", e instanceof Error ? e.message : String(e)), [push]);
  return (
    <Ctx.Provider value={{ ok, err }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-32px)]" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="glass card shadow-pop px-4 py-3 flex items-start gap-3 text-sm">
            {t.kind === "ok" ? <CheckCircle2 className="h-5 w-5 text-[#34c759] shrink-0" /> : <AlertCircle className="h-5 w-5 text-[#ff3b30] shrink-0" />}
            <span className="flex-1">{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}><X className="h-4 w-4 muted" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
