"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend, ComposedChart } from "recharts";

const compact = (v: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const PALETTE = ["#0a84ff", "#34c759", "#ff9f0a", "#af52de", "#ff375f", "#5ac8fa", "#ffd60a", "#64d2ff", "#bf5af2", "#30d158"];
const axis = { fontSize: 11, fill: "var(--ink-3)" };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--ink-1)" } };
type Row = Record<string, string | number | null>;

export function Bars({ data, x = "name", bars, height = 220, stacked, horizontal, colors }: { data: Row[]; x?: string; bars: { key: string; label?: string; color?: string }[]; height?: number; stacked?: boolean; horizontal?: boolean; colors?: string[] }) {
  if (!data.length) return <div className="text-sm muted py-10 text-center">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 20 : -10, right: 10, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={!horizontal} horizontal={!!horizontal || true} />
        {horizontal ? <><XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} /><YAxis type="category" dataKey={x} tick={axis} width={110} axisLine={false} tickLine={false} /></>
          : <><XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval={0} /><YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} width={48} /></>}
        <Tooltip {...tip} cursor={{ fill: "rgba(127,127,127,.08)" }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.label ?? b.key} stackId={stacked ? "a" : undefined} fill={b.color ?? PALETTE[i]} radius={stacked ? 0 : horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36}>
            {colors && bars.length === 1 && data.map((_, j) => <Cell key={j} fill={colors[j % colors.length]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 200, colors }: { data: { name: string; value: number; color?: string }[]; height?: number; colors?: string[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div className="text-sm muted py-10 text-center">No data yet</div>;
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: height, height }} className="relative shrink-0">
        <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color ?? colors?.[i] ?? PALETTE[i % PALETTE.length]} />)}
        </Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-2xl font-semibold">{total}</span><span className="text-[11px] muted">total</span></div>
      </div>
      <ul className="text-xs space-y-1.5 min-w-0">{data.filter((d) => d.value > 0).map((d, i) => <li key={d.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color ?? colors?.[i] ?? PALETTE[i % PALETTE.length] }} /><span className="truncate">{d.name}</span><span className="muted ms-auto ps-2">{d.value}</span></li>)}</ul>
    </div>
  );
}

export function Lines({ data, x = "date", lines, height = 240, area }: { data: Row[]; x?: string; lines: { key: string; label?: string; color?: string; dashed?: boolean }[]; height?: number; area?: boolean }) {
  if (!data.length) return <div className="text-sm muted py-10 text-center">No data yet</div>;
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ left: -10, right: 10, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} minTickGap={20} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
        <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
        {lines.map((l, i) => area
          ? <Area key={l.key} type="monotone" dataKey={l.key} name={l.label ?? l.key} stackId="1" stroke={l.color ?? PALETTE[i]} fill={l.color ?? PALETTE[i]} fillOpacity={0.35} />
          : <Line key={l.key} type="monotone" dataKey={l.key} name={l.label ?? l.key} stroke={l.color ?? PALETTE[i]} strokeWidth={2} dot={false} strokeDasharray={l.dashed ? "5 4" : undefined} connectNulls={false} />)}
      </Chart>
    </ResponsiveContainer>
  );
}

export function Combo({ data, x = "name", bars, lines, height = 240 }: { data: Row[]; x?: string; bars: { key: string; label?: string; color?: string }[]; lines: { key: string; label?: string; color?: string }[]; height?: number }) {
  if (!data.length) return <div className="text-sm muted py-10 text-center">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -10, right: 10, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
        <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.label ?? b.key} fill={b.color ?? PALETTE[i]} radius={[6, 6, 0, 0]} maxBarSize={28} />)}
        {lines.map((l, i) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.label ?? l.key} stroke={l.color ?? PALETTE[i + 3]} strokeWidth={2} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
