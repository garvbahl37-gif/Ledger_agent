import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart'

/**
 * The distribution of raw p-values across the session.
 *
 * Under a true null, p-values are uniform on [0,1] — so a flat histogram is
 * what a dataset with no structure should produce, and the NULLSET suite is
 * exactly this shape. A spike in the leftmost bin is where real signal lives.
 * A hump in the middle or at the right usually means something is wrong with
 * the tests rather than interesting about the data.
 *
 * This is the diagnostic a statistician reaches for first and no
 * chat-with-your-CSV tool shows.
 */

const config = { count: { label: 'Hypotheses', color: 'var(--color-brand)' } }

export default function PValueHistogram({ entries, bins = 10, height = 200 }) {
  const { data, n, expected } = useMemo(() => {
    const ps = entries
      .map((e) => e.statistical_result?.raw_p_value)
      .filter((p) => p != null && Number.isFinite(p))

    const counts = Array.from({ length: bins }, (_, i) => ({
      bin: `${(i / bins).toFixed(1)}–${((i + 1) / bins).toFixed(1)}`,
      lower: i / bins,
      count: 0,
    }))

    for (const p of ps) {
      const idx = Math.min(Math.floor(p * bins), bins - 1)
      counts[idx].count += 1
    }
    return { data: counts, n: ps.length, expected: ps.length / bins }
  }, [entries, bins])

  if (!n) return null

  return (
    <figure className="m-0">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 18, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="bin" tickLine={false} axisLine={false} tickMargin={8} interval={0}
            tick={{ fontSize: 9.5 }}
            label={{
              value: 'raw p-value', position: 'insideBottom', offset: -10,
              style: { fontSize: 10.5, fill: 'var(--color-slate)' },
            }}
          />
          <YAxis
            tickLine={false} axisLine={false} tickMargin={6} width={30} allowDecimals={false}
          />
          <ReferenceLine
            y={expected} stroke="var(--color-muted-mark)" strokeWidth={1.5} strokeDasharray="3 3"
            label={{
              value: 'uniform', position: 'right',
              style: { fontSize: 9.5, fill: 'var(--color-slate)' },
            }}
          />
          <ChartTooltip content={<ChartTooltipContent labelKey="bin" />} cursor={{ fill: 'var(--color-mist)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.bin}
                fill={d.lower < 0.05 ? 'var(--color-supported)' : 'var(--color-muted-mark)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      <figcaption className="mt-2 text-[12.5px] leading-relaxed text-slate">
        Under a true null, p-values are uniform — the dashed line is what {n} hypotheses with no real
        structure would produce in each bin. A spike in the leftmost bin is signal; a flat histogram
        is the correct answer for a dataset that contains nothing.
      </figcaption>
    </figure>
  )
}
