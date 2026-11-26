"use client";
import { useTx } from "@/components/t";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GRID = "hsl(var(--border))";
const TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="tnum text-foreground">{money ? Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}</b>
        </p>
      ))}
    </div>
  );
}

const Empty = () => <p className="py-10 text-center text-sm text-muted-foreground">No data in this range</p>;

export function TrendChart({ data, series: rawSeries, height = 260, area = true, money }: { data: Record<string, string | number>[]; series: { key: string; color: string; name: string }[]; height?: number; area?: boolean; money?: boolean }) {
  const tx = useTx(); const series = rawSeries.map((s) => ({ ...s, name: tx(s.name) }));
  if (!data.length) return <Empty />;
  if (area) {
    return (
      <div style={{ height }} role="img" aria-label="Trend chart"><ResponsiveContainer><AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>{series.map((s) => (
          <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.28} /><stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
          </linearGradient>))}
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip money={money} />} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} />)}</AreaChart></ResponsiveContainer></div>
    );
  }
  return (
    <div style={{ height }} role="img" aria-label="Trend chart"><ResponsiveContainer><LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
      <CartesianGrid strokeDasharray="3 6" stroke={GRID} vertical={false} /><XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={false} tickMargin={8} /><YAxis tick={TICK} tickLine={false} axisLine={false} width={48} />
      <Tooltip content={<ChartTooltip money={money} />} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
      {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} />)}</LineChart></ResponsiveContainer></div>
  );
}

export function BarsChart({ data, xKey, series: rawSeries, height = 260, layout, money }: { data: Record<string, string | number>[]; xKey: string; series: { key: string; color: string; name: string }[]; height?: number; layout?: "horizontal" | "vertical"; money?: boolean }) {
  const tx = useTx(); const series = rawSeries.map((s) => ({ ...s, name: tx(s.name) }));
  if (!data.length) return <Empty />;
  const vertical = layout === "vertical";
  return (
    <div style={{ height }} role="img" aria-label="Bar chart"><ResponsiveContainer><BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ left: 8, right: 12, top: 8 }}>
      <CartesianGrid strokeDasharray="3 6" stroke={GRID} horizontal={!vertical} vertical={vertical} />
      {vertical ? <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} /> : <XAxis dataKey={xKey} tick={TICK} tickLine={false} axisLine={false} tickMargin={8} />}
      {vertical ? <YAxis type="category" dataKey={xKey} tick={TICK} tickLine={false} axisLine={false} width={90} /> : <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} />}
      <Tooltip content={<ChartTooltip money={money} />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} /><Legend wrapperStyle={{ fontSize: 12 }} />
      {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />)}</BarChart></ResponsiveContainer></div>
  );
}

export function DonutChart({ data: rawData, height = 240, centerLabel, centerValue }: { data: { name: string; value: number; color: string }[]; height?: number; centerLabel?: string; centerValue?: string }) {
  const tx = useTx(); const data = rawData.map((d) => ({ ...d, name: tx(d.name) }));
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="relative" style={{ height }} role="img" aria-label="Breakdown chart">
      <ResponsiveContainer><PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart></ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="tnum text-2xl font-bold tracking-tight">{centerValue}</p>
          {centerLabel ? <p className="text-xs text-muted-foreground">{tx(centerLabel)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
