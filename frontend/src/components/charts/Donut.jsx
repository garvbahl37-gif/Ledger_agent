import { PieChart, Pie, Cell, Label } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart'

/**
 * A part-to-whole with a figure in the middle.
 *
 * Used only where the whole genuinely matters — the registry split, where the
 * denominator is the point of the product. Not a general-purpose chart: for
 * anything else a stacked bar reads more accurately than an angle.
 */
export default function Donut({ data, config, centerValue, centerLabel, size = 170 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return null

  return (
    <ChartContainer config={config} className="aspect-square" style={{ height: size, width: size }}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
        <Pie
          data={data} dataKey="value" nameKey="name"
          innerRadius={size * 0.31} outerRadius={size * 0.44}
          paddingAngle={2} strokeWidth={2} stroke="var(--color-paper)"
          isAnimationActive={false}
        >
          {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox)) return null
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan
                    x={viewBox.cx} y={viewBox.cy - 4}
                    style={{ fontSize: 24, fontWeight: 600, fill: 'var(--color-ink)' }}
                    className="tnum"
                  >
                    {centerValue}
                  </tspan>
                  <tspan
                    x={viewBox.cx} y={viewBox.cy + 15}
                    style={{ fontSize: 10.5, fill: 'var(--color-slate)' }}
                  >
                    {centerLabel}
                  </tspan>
                </text>
              )
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
