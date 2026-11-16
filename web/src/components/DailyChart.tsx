import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageResponse } from "../api";
import { agentColor } from "../agents";
import { useI18n } from "../i18n";

export type Metric = "cost" | "tokens";

interface Props {
  data: UsageResponse;
  metric: Metric;
}

export function DailyChart({ data, metric }: Props) {
  const { t, f } = useI18n();
  // Largest agent first so it sits behind the smaller ones.
  const agents = [...data.agents].sort((a, b) => b[metric] - a[metric]);
  const rows = data.daily.map((d) => {
    const row: Record<string, number | string> = { date: d.date };
    for (const a of agents) row[a.agent] = d.agents[a.agent]?.[metric] ?? 0;
    return row;
  });

  const dates = data.daily.map((d) => d.date);
  const ticks = dates.length > 2 ? [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates.at(-1)!] : dates;
  const fmt = metric === "cost" ? f.moneyShort : f.tokens;
  const fmtFull = metric === "cost" ? f.money : f.tokens;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={f.dateShort}
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={fmt}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickCount={5}
          />
          <Tooltip
            cursor={{ stroke: "var(--grid-strong)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-date">{f.dateLong(String(label))}</div>
                  {[...payload]
                    .sort((a, b) => Number(b.value) - Number(a.value))
                    .map((p) => (
                      <div key={String(p.dataKey)} className="chart-tooltip-row">
                        <span className="dot" style={{ background: p.color }} />
                        <span>{data.agents.find((a) => a.agent === p.dataKey)?.label ?? String(p.dataKey)}</span>
                        <span className="num">{fmtFull(Number(p.value))}</span>
                      </div>
                    ))}
                  {payload.length > 1 && (
                    <div className="chart-tooltip-row total">
                      <span />
                      <span>{t.total}</span>
                      <span className="num">{fmtFull(total)}</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          {agents.map((a, i) => (
            <Area
              key={a.agent}
              type="monotone"
              dataKey={a.agent}
              stroke={agentColor(a.agent, i)}
              strokeWidth={1.75}
              fill={agentColor(a.agent, i)}
              fillOpacity={0.12}
              isAnimationActive={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
