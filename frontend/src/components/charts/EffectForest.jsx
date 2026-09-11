import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, ReferenceLine,
} from 'recharts'
import { ChartContainer, ChartTooltip } from '../ui/chart'
import { formatNum, formatP, effectMagnitude } from '../../lib/format'

/**
 * Effect sizes for every registered hypothesis, ordered by magnitude.
 *
 * The counterweight to the staircase: that one answers "is it real", this one
 * answers "how big". A large enough n makes almost anything significant, so a
 * report without magnitude is not a finding. Supported entries carry the hue,
 * the rest go grey (emphasis), and every bar is direct-laBelled so the reading
 * never depends on colour alone.
 *
 * Cohen's conventions are drawn as reference lines rather than described, so
 * "medium" is a position on the axis instead of an adjective.
 */

const config = { effect: { label: 'Effect size', color: 'var(--color-supported)' } }

function ForestTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="max-w-[16rem] rounded-lg border border-silver bg-paper px-2.5 py-2 shadow-float">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold text-brand-text">{d.id}</span>
        <span className="text-[10.5px] text-slate">{d.label}</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-ink">{d.statement}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-silver-sub pt-1.5">
        <dt className="text-[10.5px] text-slate">effect</dt>
        <dd className="tnum text-right font-mono text-[10.5px] text-ink">{formatNum(d.value, 3)}</dd>
        <dt className="text-[10.5px] text-slate">test</dt>
        <dd className="text-right font-mono text-[10.5px] text-ink">{d.test}</dd>
        {d.pAdj != null && (<>
          <dt className="text-[10.5px] text-slate">adjusted p</dt>
          <dd className="tnum text-right font-mono text-[10.5px] text-ink">{formatP(d.pAdj)}</dd>
        </>)}
      </dl>
    </div>
  )
}

export default function EffectForest({ entries, height = 300 }) {
  const data = useMemo(() => (
    entries
      .filter((e) => e.statistical_result?.effect_size != null)
      .map((e) => ({
        id: e.id,
        statement: e.statement,
        value: e.statistical_result.effect_size,
        abs: Math.abs(e.statistical_result.effect_size),
        label: effectMagnitude(e.statistical_result.effect_size_label, e.statistical_result.effect_size),
        test: e.statistical_result.test_name,
        pAdj: e.statistical_result.fdr_adjusted_p_value,
        supported: e.status === 'SUPPORTED',
      }))
      .sort((a, b) => b.abs - a.abs)
  ), [entries])

  if (!data.length) return null

  const max = Math.max(...data.map((d) => d.abs), 0.9)
  const chartHeight = Math.max(height, data.length * 26 + 46)
  const marks = [
    { v: 0.2, name: 'small' },
    { v: 0.5, name: 'medium' },
    { v: 0.8, name: 'large' },
  ].filter((mk) => mk.v < max)

  return (
    <figure className="m-0">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: chartHeight }}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 54, bottom: 34, left: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number" dataKey="abs" domain={[0, max * 1.04]}
            tickLine={false} axisLine={false} tickMargin={8}
            label={{
              value: 'absolute effect size',
              position: 'insideBottom', offset: -24,
              style: { fontSize: 10.5, fill: 'var(--color-slate)' },
            }}
          />
          <YAxis
            type="category" dataKey="id" width={42}
            tickLine={false} axisLine={false} tickMargin={6}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
          />

          {marks.map((mk) => (
            <ReferenceLine
              key={mk.name} x={mk.v}
              stroke="var(--color-silver)" strokeWidth={1} strokeDasharray="2 3"
              label={{
                value: mk.name, position: 'bottom', offset: 6,
                style: { fontSize: 9.5, fill: 'var(--color-slate)' },
              }}
            />
          ))}

          <ChartTooltip content={<ForestTooltip />} cursor={{ fill: 'var(--color-mist)' }} />

          <Bar dataKey="abs" radius={4} isAnimationActive={false} maxBarSize={13}>
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={d.supported ? 'var(--color-supported)' : 'var(--color-muted-mark)'}
              />
            ))}
            {/* Direct labels are mandatory — two slots in this palette sit under 3:1 */}
            <LabelList
              dataKey="value" position="right" offset={8}
              formatter={(v) => formatNum(v, 2)}
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
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--color-supported)' }} />
          Supported
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--color-muted-mark)' }} />
          Not supported
        </span>
        <span>Dashed marks are Cohen's conventions</span>
      </div>
    </figure>
  )
}
