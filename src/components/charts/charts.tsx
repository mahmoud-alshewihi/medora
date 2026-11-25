"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data, series, height = 260 }: { data: Record<string, string | number>[]; series: { key: string; color: string; name: string }[]; height?: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No data in this range</p>;
  return (
    <div style={{ height }} role="img" aria-label="Trend chart"><ResponsiveContainer><LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 80% / .5)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={48} /><Tooltip /><Legend />
      {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} />)}</LineChart></ResponsiveContainer></div>
  );
}
export function BarsChart({ data, xKey, series, height = 260 }: { data: Record<string, string | number>[]; xKey: string; series: { key: string; color: string; name: string }[]; height?: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No data in this range</p>;
  return (
    <div style={{ height }} role="img" aria-label="Bar chart"><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 80% / .5)" /><XAxis dataKey={xKey} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={48} /><Tooltip /><Legend />
      {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer></div>
  );
}
