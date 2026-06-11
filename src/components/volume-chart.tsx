"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const chartElement = element;

    function updateSize() {
      const rect = chartElement.getBoundingClientRect();

      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    }

    updateSize();

    if (!("ResizeObserver" in window)) {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(chartElement);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full">
      {size.width > 0 && size.height > 0 ? (
        <BarChart
          data={data}
          height={size.height}
          margin={{ left: -20, right: 4 }}
          width={size.width}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "rgba(24, 24, 27, 0.08)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            }}
          />
          <Bar dataKey="volume" name="볼륨 kg" fill="#18181b" radius={4} />
          <Bar dataKey="protein" name="단백질 g" fill="#a1a1aa" radius={4} />
        </BarChart>
      ) : null}
    </div>
  );
}
