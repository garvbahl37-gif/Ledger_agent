import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '../../lib/cn'

/**
 * shadcn/ui chart primitives, adapted to the Ledger token system.
 *
 * The config maps a series key to a label and a colour, and ChartStyle emits
 * those as `--color-<key>` custom properties scoped to the chart instance. Every
 * chart below then references `var(--color-p)` rather than a literal hex, so a
 * palette change is one edit in the config and never a sweep through JSX.
 */

const ChartContext = React.createContext(null)

function useChart() {
  const ctx = React.useContext(ChartContext)
  if (!ctx) throw new Error('useChart must be used inside <ChartContainer>')
  return ctx
}

const ChartContainer = React.forwardRef(function ChartContainer(
  { id, className, children, config, ...props }, ref,
) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-[11.5px]",
          "[&_.recharts-cartesian-axis-tick_text]:fill-slate",
          "[&_.recharts-cartesian-grid_line]:stroke-silver-sub",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-silver",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-silver-sub",
          "[&_.recharts-radial-bar-background-sector]:fill-fog",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-fog",
          "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-silver",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})

function ChartStyle({ id, config }) {
  const colorful = Object.entries(config || {}).filter(([, v]) => v.color)
  if (!colorful.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorful
          .map(([key, item]) => `  --color-${key}: ${item.color};`)
          .join('\n')}\n}`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef(function ChartTooltipContent(
  {
    active, payload, className, indicator = 'dot', hideLabel, hideIndicator,
    label, labelFormatter, labelClassName, formatter, color, nameKey, labelKey,
  },
  ref,
) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null
    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || 'value'}`
    const itemConfig = getPayloadConfig(config, item, key)
    const value = !labelKey && typeof label === 'string'
      ? config[label]?.label || label
      : itemConfig?.label

    if (labelFormatter) {
      return <div className={cn('font-medium text-ink', labelClassName)}>{labelFormatter(value, payload)}</div>
    }
    if (!value) return null
    return <div className={cn('font-medium text-ink', labelClassName)}>{value}</div>
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey])

  if (!active || !payload?.length) return null

  const nestLabel = payload.length === 1 && indicator !== 'dot'

  return (
    <div
      ref={ref}
      className={cn(
        'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-silver bg-paper px-2.5 py-2 text-[11.5px] shadow-float',
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`
          const itemConfig = getPayloadConfig(config, item, key)
          const indicatorColor = color || item.payload?.fill || item.color

          return (
            <div
              key={item.dataKey ?? index}
              className={cn(
                'flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-slate',
                indicator === 'dot' && 'items-center',
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
                          'h-2.5 w-2.5': indicator === 'dot',
                          'w-1': indicator === 'line',
                          'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                          'my-0.5': nestLabel && indicator === 'dashed',
                        })}
                        style={{ '--color-bg': indicatorColor, '--color-border': indicatorColor }}
                      />
                    )
                  )}
                  <div
                    className={cn(
                      'flex flex-1 justify-between leading-none',
                      nestLabel ? 'items-end' : 'items-center',
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-slate">{itemConfig?.label || item.name}</span>
                    </div>
                    {item.value !== undefined && (
                      <span className="tnum font-mono font-medium text-ink">
                        {typeof item.value === 'number'
                          ? item.value.toLocaleString()
                          : item.value}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef(function ChartLegendContent(
  { className, hideIcon, payload, verticalAlign = 'bottom', nameKey }, ref,
) {
  const { config } = useChart()
  if (!payload?.length) return null

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-center gap-x-5 gap-y-1.5 flex-wrap',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || 'value'}`
        const itemConfig = getPayloadConfig(config, item, key)
        return (
          <div key={item.value} className="flex items-center gap-1.5 text-[11.5px] text-slate">
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
            )}
            {itemConfig?.label || item.value}
          </div>
        )
      })}
    </div>
  )
})

function getPayloadConfig(config, payload, key) {
  if (typeof payload !== 'object' || payload === null) return undefined
  const inner = payload.payload && typeof payload.payload === 'object' ? payload.payload : undefined

  let configLabelKey = key
  if (key in payload && typeof payload[key] === 'string') {
    configLabelKey = payload[key]
  } else if (inner && key in inner && typeof inner[key] === 'string') {
    configLabelKey = inner[key]
  }
  return configLabelKey in (config || {}) ? config[configLabelKey] : config?.[key]
}

export {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent, ChartStyle, useChart,
}
