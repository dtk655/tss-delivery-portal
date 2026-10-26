"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { afterSplash } from "@/components/splash";

const RED = "#e10600";
const YELLOW = "#ffd100";
const ASPHALT = "#1f2429";
const TICK = "#646e78";
const GRID = "#e0e3e6";

function ChartFrame({ children, height = "h-60" }: { children: React.ReactNode; height?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => afterSplash(() => setReady(true)), []);
  return <div className={`${height} w-full`}>{ready ? children : null}</div>;
}

type Row = { label: string; full: string; sales: number; rentals: number; pickups: number; today: boolean };

export function ScheduleChart({ rows }: { rows: Row[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(21,24,27,0.05)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (!active || !row) return null;
              return (
                <div className="rounded-lg bg-asphalt px-3 py-2 text-sm text-white shadow-lg">
                  <div className="text-xs text-[#b7bec5]">{row.full}</div>
                  <div className="figure text-base font-bold">{row.sales + row.rentals + row.pickups} stops</div>
                  <div className="mt-1 space-y-0.5 text-xs text-[#d5dade]">
                    <div>{row.rentals} rental drop-offs</div>
                    <div>{row.sales} sales</div>
                    <div>{row.pickups} pickups</div>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="rentals" stackId="a" fill={ASPHALT} maxBarSize={44} isAnimationActive={false}>
            {rows.map((row) => (
              <Cell key={row.label} fill={row.today ? RED : ASPHALT} />
            ))}
          </Bar>
          <Bar dataKey="sales" stackId="a" fill={YELLOW} maxBarSize={44} isAnimationActive={false} />
          <Bar dataKey="pickups" stackId="a" fill="#c9cfd4" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
