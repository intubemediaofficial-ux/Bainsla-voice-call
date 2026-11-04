"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CallsChart({ data }: { data: { day: string; calls: number; connected: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7c5cff" stopOpacity={0.35} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0} /></linearGradient>
            <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff9f1c" stopOpacity={0.35} /><stop offset="100%" stopColor="#ff9f1c" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Area type="monotone" dataKey="calls" name="Calls" stroke="#6a45f5" strokeWidth={2} fill="url(#g1)" />
          <Area type="monotone" dataKey="connected" name="Answered" stroke="#ff9f1c" strokeWidth={2} fill="url(#g2)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
