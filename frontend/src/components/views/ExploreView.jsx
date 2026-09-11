import { useMemo, useState } from 'react'
import { BarChart3, Grid3x3, LineChart, ScatterChart } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSession } from '../../lib/store'
import PlotlyChart from '../charts/PlotlyChart'
import { Card } from '../ui/Card'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

/**
 * The exploratory dashboard A10 builds from the cleaned table.
 *
 * Deliberately separate from the report: nothing here has been corrected for
 * multiple comparisons, and a pattern you spot by eye in a correlation heatmap
 * is a hypothesis, not a finding. The banner says so, because the whole point
 * of the product is not letting people confuse the two.
 */
export default function ExploreView({ onNavigate }) {
  const report = useSession((s) => s.report)
  const dash = report?.visualization_dashboard
  const [tab, setTab] = useState('quality')

  const tabs = useMemo(() => {
    if (!dash) return []
    const out = []
    if (dash.summary_stats_chart) out.push({ id: 'quality', label: 'Data quality', icon: Grid3x3, count: 1 })
    if (dash.distribution_charts?.length) out.push({ id: 'dist', label: 'Distributions', icon: BarChart3, count: dash.distribution_charts.length })
    if (dash.correlation_heatmap) out.push({ id: 'corr', label: 'Correlations', icon: ScatterChart, count: 1 })
    if (dash.time_series_charts?.length) out.push({ id: 'time', label: 'Over time', icon: LineChart, count: dash.time_series_charts.length })
    return out
  }, [dash])

  if (!report || !dash || tabs.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No exploratory charts yet"
        body="The visual analyst builds these from the cleaned table right after it loads. Run an analysis to fill this in."
        action={<Button variant="primary" onClick={() => onNavigate?.('setup')}>Load a table</Button>}
      />
    )
  }

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Explore the table</h2>
        <p className="measure mt-1.5 text-[14px] leading-relaxed text-slate">
          Distributions, missingness and correlations, drawn straight from the cleaned data.
        </p>
      </header>

      {/* The distinction this product exists to protect */}
      <div className="mt-4 rounded-xl bg-warn-tint px-4 py-3 ring-1 ring-warn-edge">
        <p className="text-[12.5px] leading-relaxed text-warn-text">
          <strong className="font-semibold">These charts are not findings.</strong> Nothing here has
          been corrected for multiple comparisons. A pattern you spot in a heatmap is a hypothesis —
          and a hypothesis noticed after seeing the data is exactly what the registry freeze exists
          to keep out of the report.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-silver" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              active === t.id
                ? 'border-brand text-brand-text'
                : 'border-transparent text-slate hover:text-ink',
            )}
          >
            <t.icon size={13} aria-hidden="true" />
            {t.label}
            <span className="tnum text-[11px] text-slate">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        {active === 'quality' && dash.summary_stats_chart && (
          <Card><PlotlyChart spec={dash.summary_stats_chart} height={380} /></Card>
        )}

        {active === 'dist' && (
          <div className="grid gap-5 xl:grid-cols-2">
            {dash.distribution_charts.map((c, i) => (
              <Card key={i} flush className="overflow-hidden p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="truncate font-mono text-[12.5px] font-medium text-ink">{c.column}</h3>
                  <span className="shrink-0 rounded-full bg-fog px-2 py-0.5 text-[10px] text-slate">
                    {c.type}
                  </span>
                </div>
                <PlotlyChart spec={c.spec} height={300} />
              </Card>
            ))}
          </div>
        )}

        {active === 'corr' && dash.correlation_heatmap && (
          <Card>
            <PlotlyChart spec={dash.correlation_heatmap} height={460} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-slate">
              Pearson correlation across the numeric columns. With k columns there are k(k−1)/2
              cells here, and on random data roughly one in twenty will look strong. That is the
              arithmetic the registry and the correction are there to answer.
            </p>
          </Card>
        )}

        {active === 'time' && (
          <div className="space-y-5">
            {dash.time_series_charts.map((c, i) => (
              <Card key={i} flush className="overflow-hidden p-4">
                <h3 className="mb-1 font-mono text-[12.5px] font-medium text-ink">
                  {c.num_col} <span className="text-slate">over</span> {c.dt_col}
                </h3>
                <PlotlyChart spec={c.spec} height={300} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
