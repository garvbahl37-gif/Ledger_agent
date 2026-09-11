import { cn } from '../../lib/cn'

/**
 * A stat tile. Per the form heuristic, a single current value is a tile, not a
 * one-bar bar chart. The label sits under the number so the eye lands on the
 * figure first.
 */
export default function Stat({ value, label, hint, tone = 'default', icon: Icon, className }) {
  const tones = {
    default:   'text-ink',
    brand:     'text-brand-text',
    supported: 'text-supported-text',
    rejected:  'text-slate',
    error:     'text-error-text',
    warn:      'text-warn-text',
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('tnum text-[26px] font-semibold leading-none tracking-tight', tones[tone])}>
          {value}
        </span>
        {Icon && <Icon size={14} className="shrink-0 text-slate" aria-hidden="true" />}
      </div>
      <div className="mt-2 text-[12.5px] font-medium text-graphite">{label}</div>
      {hint && <div className="mt-0.5 text-[11.5px] leading-snug text-slate">{hint}</div>}
    </div>
  )
}
