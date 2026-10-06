"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

export interface SeriesPoint {
  label: string;
  value: number | null;
  prev: number;
  orders: number;
}

const AXIS = { fontSize: 11, fill: "#97958c" } as const;

function ChartTip({ active, payload, label, prevLabel }: { active?: boolean; payload?: { payload: SeriesPoint }[]; label?: string; prevLabel: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-fg">{label}</p>
      <p className="tnum flex items-center justify-between gap-6"><span className="flex items-center gap-1.5 text-fg-muted"><i className="size-2 rounded-full bg-brand" />Sales</span><b>{p.value == null ? "—" : formatMoney(p.value)}</b></p>
      <p className="tnum flex items-center justify-between gap-6"><span className="flex items-center gap-1.5 text-fg-muted"><i className="size-2 rounded-full bg-[#b9b6ab]" />{prevLabel}</span><span>{formatMoney(p.prev)}</span></p>
      <p className="tnum mt-1 text-fg-subtle">{p.orders} orders</p>
    </div>
  );
}

export function SalesChart({ data, height = 240, prevLabel = "Previous", kind = "area" }: { data: SeriesPoint[]; height?: number; prevLabel?: string; kind?: "area" | "bar" }) {
  const dense = data.length > 16;
  const common = (
    <>
      <CartesianGrid stroke="#ece9e2" vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval={dense ? Math.ceil(data.length / 8) - 1 : 0} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} tick={AXIS} width={44} tickFormatter={(v: number) => formatMoneyCompact(v).replace(".0", "")} />
      <Tooltip cursor={{ stroke: "#d6d3ca", strokeDasharray: "3 3" }} content={<ChartTip prevLabel={prevLabel} />} />
    </>
  );
  return (
    <div style={{ height }} role="img" aria-label="Sales chart" className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            {common}
            <Bar dataKey="value" fill="#2c5a4b" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillBrand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2c5a4b" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#2c5a4b" stopOpacity={0} />
              </linearGradient>
            </defs>
            {common}
            <Line type="monotone" dataKey="prev" stroke="#b9b6ab" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="value" stroke="#2c5a4b" strokeWidth={2} fill="url(#fillBrand)" dot={false} activeDot={{ r: 3.5, strokeWidth: 0, fill: "#2c5a4b" }} isAnimationActive={false} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
