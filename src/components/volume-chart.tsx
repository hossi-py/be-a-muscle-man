"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  date: string;
  volume: number;
  protein: number;
};

export function VolumeChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -20, right: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} />
        <Tooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e4e4e7",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          }}
        />
        <Bar dataKey="volume" name="볼륨 kg" fill="#059669" radius={4} />
        <Bar dataKey="protein" name="단백질 g" fill="#0284c7" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
