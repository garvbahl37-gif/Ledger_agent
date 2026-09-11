import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts'
import { ChartContainer, ChartTooltip } from '../ui/chart'
import { formatDuration } from '../../lib/format'
import { agentForStage, ALL_AGENTS } from '../../lib/agents'

/**
 * Wall-clock per agent. Reported honestly rather than engineered around —
 * the synopsis commits to that, and the shape is usually informative: the two
 * model-backed steps dominate, and the deterministic adjudication that decides
 * every verdict is close to free.
 */

const config = { seconds: { label: 'Seconds', color: 'var(--color-brand)' } }

function TimingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="max-w-[15rem] rounded-lg border border-silver bg-paper px-2.5 py-2 shadow-float">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: d.accent }} />
        <span className="text-[11.5px] font-semibold text-ink">{d.key} {d.name}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate">{d.role}</p>
      <div className="mt-1.5 flex items-center justify-between border-t border-silver-sub pt-1.5">
        <span className="text-[10.5px] text-slate">{d.deterministic ? 'No model involved' : d.nature}</span>
        <span className="tnum font-mono text-[10.5px] font-medium text-ink">{formatDuration(d.seconds)}</span>
      </div>
    </div>
  )
}

export default function AgentTimings({ timings, height = 240 }) {
  const data = useMemo(() => {
    if (!timings) return []
    return Object.entries(timings)
      .map(([key, seconds]) => {
        const meta = ALL_AGENTS.find((a) => a.key === key) || agentForStage(key)
        return {
          key,
          name: meta?.name ?? key,
          role: meta?.role ?? '',
          nature: meta?.nature ?? '',
          deterministic: meta?.deterministic ?? false,
          accent: meta?.accent ?? 'var(--color-muted-mark)',
          seconds: Number(seconds) || 0,
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  }, [timings])

  if (!data.length) return null
  const total = data.reduce((s, d) => s + d.seconds, 0)

  return (
    <figure className="m-0">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="seconds" tickLine={false} axisLine={false} tickMargin={8} hide />
          <YAxis
            type="category" dataKey="key" width={34}
            tickLine={false} axisLine={false} tickMargin={6}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
          />
          <ChartTooltip content={<TimingTooltip />} cursor={{ fill: 'var(--color-mist)' }} />
          <Bar dataKey="seconds" radius={4} isAnimationActive={false} maxBarSize={15}>
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={d.accent}
                fillOpacity={d.deterministic ? 1 : 0.55}
              />
            ))}
            <LabelList
              dataKey="seconds" position="right" offset={8}
              formatter={(v) => formatDuration(v)}
              style={{
                fontSize: 10.5, fontFamily: 'var(--font-mono)',
                fill: 'var(--color-graphite)', fontVariantNumeric: 'tabular-nums',
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-slate">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" />
          Solid — deterministic
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-brand opacity-55" />
          Faded — model involved
        </span>
        <span className="tnum">Total {formatDuration(total)}</span>
      </div>
    </figure>
  )
}
