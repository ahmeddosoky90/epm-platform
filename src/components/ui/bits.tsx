import type { ReactNode } from "react";
import clsx from "clsx";

export const HEALTH: Record<string, { label: string; color: string }> = {
  GREEN: { label: "On track", color: "#34c759" }, AMBER: { label: "At risk", color: "#ff9f0a" }, RED: { label: "Off track", color: "#ff3b30" },
};
export const PRIORITY_COLOR: Record<string, string> = { Blocker: "#ff3b30", Critical: "#ff453a", High: "#ff9f0a", Medium: "#0a84ff", Low: "#8e8e93" };
export const STATUS_LABEL: Record<string, string> = { PROPOSED: "Proposed", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export function Dot({ color }: { color: string }) { return <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: color }} />; }

export function Chip({ color, children, solid }: { color: string; children: ReactNode; solid?: boolean }) {
  return <span className="chip whitespace-nowrap" style={solid ? { background: color, color: "#fff" } : { background: `${color}1f`, color }}>{children}</span>;
}
export function Health({ h }: { h: string }) { const x = HEALTH[h] ?? HEALTH.GREEN; return <Chip color={x.color}>{x.label}</Chip>; }
export function Priority({ p }: { p: string }) { return <span className="inline-flex items-center gap-1.5 text-xs"><Dot color={PRIORITY_COLOR[p] ?? "#8e8e93"} />{p}</span>; }
export function StatusPill({ name, color }: { name: string; color: string }) { return <Chip color={color}>{name}</Chip>; }

export function Avatar({ name, size = 24 }: { name?: string | null; size?: number }) {
  if (!name) return <span className="inline-flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-ink-3 text-[10px]" style={{ width: size, height: size }}>—</span>;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span title={name} className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 48%))` }}>{initials}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs muted mb-1">{label}</div>
      <div className="text-2xl font-semibold tracking-tight" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="text-xs muted mt-1">{sub}</div>}
    </div>
  );
}

export function Card({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("card", className)}>
      {title && <div className="flex items-center justify-between px-4 pt-4 pb-2"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>}
      <div className={pad ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="text-center py-10"><div className="text-sm font-medium">{title}</div>{children && <div className="text-sm muted mt-1">{children}</div>}</div>;
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-6">
      {crumbs && <nav aria-label="Breadcrumb" className="text-xs muted mb-2 flex gap-1.5 flex-wrap">{crumbs.map((c, i) => <span key={i} className="flex gap-1.5">{c.href ? <a className="hover:text-ink-1" href={c.href}>{c.label}</a> : <span>{c.label}</span>}{i < crumbs.length - 1 && <span>/</span>}</span>)}</nav>}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div><h1 className="h1">{title}</h1>{subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}</div>
        {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, color = "#0a84ff" }: { value: number; color?: string }) {
  return <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}
