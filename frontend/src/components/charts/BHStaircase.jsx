import { useMemo } from 'react'
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ReferenceArea, Cell, ZAxis,
} from 'recharts'
import { ChartContainer, ChartTooltip } from '../ui/chart'
import { formatP } from '../../lib/format'

/**
 * The Benjamini–Hochberg staircase — the chart that shows the architecture.
 *
 * Sorted p-values against the critical line i·q/m. Everything at or below the
 * line, left of the cut, survives. The reason this exists rather than a bar of
 * "findings": m is the denominator, and m was fixed at the freeze, before any
 * result was seen. A tool that quietly dropped its failures would have a
 * smaller m and a more permissive line. Plotting all m makes that unhideable.
 *
 * Form: polarity against a threshold → emphasis encoding (one hue + grey), not
 * categorical. Log y, because these p-values span many orders of magnitude.
 */

const config = {
  p:    { label: 'p-value',           color: 'var(--color-supported)' },
  crit: { label: 'BH critical value', color: 'var(--color-brand)' },
}

function PointMark(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  const fill = payload.survives ? 'var(--color-supported)' : 'var(--color-muted-mark)'

  // Pinned points get a downward triangle — the shape says "continues below".
  if (payload.pinned) {
    return (
      <path
        d={`M${cx - 5.5},${cy - 4} L${cx + 5.5},${cy - 4} L${cx},${cy + 5.5} Z`}
        fill={fill} stroke="var(--color-paper)" strokeWidth={1.5}
      />
    )
  }
  return <circle cx={cx} cy={cy} r={4.5} fill={fill} stroke="var(--color-paper)" strokeWidth={2} />
}

function StaircaseTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="max-w-[16rem] rounded-lg border border-silver bg-paper px-2.5 py-2 shadow-float">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold text-brand-text">{d.id}</span>
        <span className="font-mono text-[10.5px] text-slate">rank {d.rank}/{d.m}</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-ink">{d.statement}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-silver-sub pt-1.5">
        <dt className="text-[10.5px] text-slate">p</dt>
        <dd className="tnum text-right font-mono text-[10.5px] text-ink">
          {formatP(d.p)}{d.pinned && <span className="text-slate"> ↓</span>}
        </dd>
        <dt className="text-[10.5px] text-slate">critical i·q/m</dt>
        <dd className="tnum text-right font-mono text-[10.5px] text-ink">{formatP(d.crit)}</dd>
        {d.pAdj != null && (<>
          <dt className="text-[10.5px] text-slate">adjusted</dt>
          <dd className="tnum text-right font-mono text-[10.5px] text-ink">{formatP(d.pAdj)}</dd>
        </>)}
      </dl>
      <p
        className="mt-1.5 text-[10.5px] font-medium"
        style={{ color: d.survives ? 'var(--color-supported-text)' : 'var(--color-slate)' }}
      >
        {d.survives ? '✓ At or below the line — survives' : '✗ Above the line — not supported'}
      </p>
    </div>
  )
}

export default function BHStaircase({ entries, q = 0.05, height = 320 }) {
  const { data, m, k, domain, ticks, offScale, floor } = useMemo(() => {
    const withP = entries
      .filter((e) => e.statistical_result?.raw_p_value != null)
      .map((e) => ({
        id: e.id,
        statement: e.statement,
        p: Math.max(e.statistical_result.raw_p_value, 1e-300),
        pAdj: e.statistical_result.fdr_adjusted_p_value,
      }))
      .sort((a, b) => a.p - b.p)

    const total = withP.length
    if (!total) return { data: [], m: 0, k: 0, domain: [1e-3, 1], ticks: [], offScale: 0, floor: 1e-3 }

    const rows = withP.map((d, i) => ({
      ...d, rank: i + 1, m: total, crit: ((i + 1) / total) * q,
    }))

    // The cut: the largest rank whose p-value is at or under its critical value.
    let cut = 0
    for (let i = total - 1; i >= 0; i--) {
      if (rows[i].p <= rows[i].crit) { cut = i + 1; break }
    }
    rows.forEach((r) => { r.survives = r.rank <= cut })

    // The axis floor is clamped rather than set to the smallest p-value.
    //
    // A single p of 1e-102 beside a dozen around 0.5 stretches a log axis over
    // a hundred decades and squashes the entire decision region — where p sits
    // near its critical value — into the top 2% of the plot. The chart would be
    // accurate and unreadable. So the floor sits two decades below the smallest
    // critical value, which is where the cut is actually decided, and anything
    // below it is pinned to the floor and drawn as a triangle. Pinned points
    // keep their true value in the tooltip and are counted in the caption, so
    // nothing is hidden — only the empty space is.
    const smallestCrit = q / total
    const floorExp = Math.max(Math.floor(Math.log10(smallestCrit)) - 2, -300)
    const floor = 10 ** floorExp

    let offScale = 0
    for (const r of rows) {
      r.pinned = r.p < floor
      if (r.pinned) offScale += 1
      r.plotted = r.pinned ? floor : r.p
    }

    const dom = [floor, 1]
    const step = Math.max(1, Math.ceil(-floorExp / 5))
    const tickList = []
    for (let e = 0; e >= floorExp; e -= step) tickList.push(10 ** e)

    return { data: rows, m: total, k: cut, domain: dom, ticks: tickList, offScale, floor }
  }, [entries, q])

  if (!data.length) return null

  return (
    <figure className="m-0">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />

          {/* The region that survives correction */}
          {k > 0 && (
            <ReferenceArea
              x1={1} x2={k} fill="var(--color-supported)" fillOpacity={0.06} strokeOpacity={0}
            />
          )}

          <XAxis
            dataKey="rank" type="number" domain={[1, m]}
            tickLine={false} axisLine={false} tickMargin={8}
            allowDecimals={false}
            label={{
              value: `hypothesis rank, ascending p  (m = ${m})`,
              position: 'insideBottom', offset: -4,
              style: { fontSize: 10.5, fill: 'var(--color-slate)' },
            }}
          />
          <YAxis
            dataKey="plotted" type="number" scale="log" domain={domain} ticks={ticks}
            tickLine={false} axisLine={false} tickMargin={6} width={52}
            tickFormatter={(v) => (v === 1 ? '1' : `1e${Math.round(Math.log10(v))}`)}
          />
          <ZAxis range={[46, 46]} />

          {/* Uncorrected threshold — context only, deliberately recessive */}
          <ReferenceLine
            y={0.05} stroke="var(--color-muted-mark)" strokeWidth={1.5} strokeDasharray="2 3"
            label={{
              value: 'uncorrected p = .05', position: 'insideTopRight', offset: 6,
              style: { fontSize: 9.5, fill: 'var(--color-slate)' },
            }}
          />
          {k > 0 && k < m && (
            <ReferenceLine
              x={k} stroke="var(--color-supported)" strokeWidth={1.5} strokeDasharray="3 3"
            />
          )}

          <ChartTooltip content={<StaircaseTooltip />} cursor={{ stroke: 'var(--color-silver)' }} />

          {/* The BH critical line */}
          <Line
            dataKey="crit" type="linear" dot={false} activeDot={false}
            stroke="var(--color-crit)" strokeWidth={2} strokeLinecap="round" isAnimationActive={false}
          />

          {/* Marks — emphasis: survivors carry the hue, the rest go grey */}
          <Scatter dataKey="plotted" isAnimationActive={false} shape={<PointMark />}>
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={d.survives ? 'var(--color-supported)' : 'var(--color-muted-mark)'}
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            ))}
          </Scatter>
        </ComposedChart>
      </ChartContainer>

      {/* Identity is never colour-alone */}
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-slate">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-supported)' }} />
          Survives correction ({k})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-muted-mark)' }} />
          Tested, not supported ({m - k})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="3" aria-hidden="true">
            <line x1="0" y1="1.5" x2="18" y2="1.5" stroke="var(--color-brand)" strokeWidth="2" />
          </svg>
          BH critical line, q = {q}
        </span>
      </div>

      <figcaption className="mt-3 text-[12.5px] leading-relaxed text-slate">
        All {m} registered hypotheses are plotted, including the {m - k} that failed. The critical
        line is <span className="font-mono text-[11.5px] text-graphite">i·q/m</span> — so m, fixed
        at the freeze before any result was seen, sets how permissive the threshold is. Dropping the
        failures would shrink m and raise this line.
        {offScale > 0 && (
          <>
            {' '}
            <span className="text-graphite">
              {offScale} {offScale === 1 ? 'point falls' : 'points fall'} below the axis floor
              of {formatP(floor)} and {offScale === 1 ? 'is' : 'are'} drawn as
              {offScale === 1 ? ' a triangle' : ' triangles'} at the edge; hover for the
              true value.
            </span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
