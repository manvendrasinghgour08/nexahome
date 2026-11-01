import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatTime, toUnit } from '../core/format';
import type { ActivityEvent, ClimateSensor, Settings } from '../core/types';

export const SERIES_COLORS = ['#7A6650', '#5F8A6B', '#C0884A', '#5D7896', '#A8696F', '#8C8C5A'];
const tooltipStyle = { background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', boxShadow: 'var(--shadow-lg)' };

export type Metric = 'temperature' | 'humidity';

/** Merge each sensor's readings onto a shared time axis. */
function toRows(sensors: ClimateSensor[], metric: Metric, unit: Settings['tempUnit'], since: number) {
  const rows = new Map<number, Record<string, number>>();
  for (const s of sensors) {
    for (const r of s.readings) {
      if (r.ts < since) continue;
      const key = Math.round(r.ts / 1000) * 1000;
      const row = rows.get(key) ?? { ts: key };
      row[s.id] = metric === 'temperature' ? Math.round(toUnit(r.value, unit) * 10) / 10 : r.humidity;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.ts - b.ts);
}

export function ClimateChart({ sensors, unit, metric = 'temperature', since = 0, height = 280 }: { sensors: ClimateSensor[]; unit: Settings['tempUnit']; metric?: Metric; since?: number; height?: number }) {
  const data = toRows(sensors, metric, unit, since);
  const suffix = metric === 'temperature' ? `°${unit}` : '%';
  if (data.length < 2) return <div className="chart-empty muted" style={{ height }}>Not enough readings in this time range yet.</div>;
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
          <defs>
            {sensors.map((s, i) => (
              <linearGradient key={s.id} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={sensors.length > 2 ? 0.06 : 0.18} />
                <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} scale="time" tickFormatter={(t: number) => formatTime(t).slice(0, 5)} stroke="var(--muted)" fontSize={12} minTickGap={48} tickLine={false} axisLine={false} />
          <YAxis
            allowDecimals={false}
            domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
            tickFormatter={(v: number) => `${v}${metric === 'temperature' ? '°' : '%'}`}
            stroke="var(--muted)"
            fontSize={12}
            width={46}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip labelFormatter={(t) => formatTime(Number(t))} formatter={(v) => `${Number(v).toFixed(metric === 'temperature' ? 1 : 0)}${suffix}`} contentStyle={tooltipStyle} />
          {sensors.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
          {sensors.map((s, i) => (
            <Area
              key={s.id}
              dataKey={s.id}
              name={s.name.replace(/ Sensor$/, '')}
              type="monotone"
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2.2}
              fill={`url(#grad-${s.id})`}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Events per hour for the last 24 hours. */
export function ActivityChart({ events, now, height = 180 }: { events: ActivityEvent[]; now: number; height?: number }) {
  const hourMs = 3_600_000;
  const end = Math.floor(now / hourMs) * hourMs;
  const data = Array.from({ length: 24 }, (_, i) => ({ ts: end - (23 - i) * hourMs, events: 0 }));
  for (const e of events) {
    const idx = 23 - Math.floor((end - Math.floor(e.ts / hourMs) * hourMs) / hourMs);
    if (idx >= 0 && idx < 24) data[idx].events++;
  }
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B9A58A" />
              <stop offset="100%" stopColor="#B9A58A" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="ts" tickFormatter={(t: number) => `${new Date(t).getHours()}h`} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} interval={3} />
          <YAxis allowDecimals={false} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'var(--hover)' }} labelFormatter={(t) => `${new Date(Number(t)).getHours()}:00 – ${new Date(Number(t)).getHours() + 1}:00`} contentStyle={tooltipStyle} />
          <Bar dataKey="events" name="Events" fill="url(#bar-grad)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
