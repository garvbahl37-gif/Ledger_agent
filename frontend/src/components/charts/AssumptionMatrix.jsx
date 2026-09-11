import { Check, X } from 'lucide-react'
import { formatP } from '../../lib/format'

/**
 * Which assumptions were checked, and what they returned.
 *
 * This is the part that decides which test ran: normality and equal variance
 * failing is exactly why Mann–Whitney appears instead of Welch's t. Showing the
 * checks makes the test selection auditable rather than asserted.
 */
export default function AssumptionMatrix({ assumptions, compact }) {
  if (!assumptions?.length) {
    return <p className="text-[12.5px] text-slate">No assumption checks recorded for this entry.</p>
  }

  return (
    <ul className="space-y-1.5">
      {assumptions.map((a, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{
              background: a.passed ? 'var(--color-supported-tint)' : 'var(--color-warn-tint)',
              color: a.passed ? 'var(--color-supported-text)' : 'var(--color-warn-text)',
            }}
          >
            {a.passed
              ? <Check size={10} strokeWidth={3} aria-hidden="true" />
              : <X size={10} strokeWidth={3} aria-hidden="true" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[12.5px] font-medium text-ink">{a.name}</span>
              <span
                className="text-[11.5px] font-medium"
                style={{ color: a.passed ? 'var(--color-supported-text)' : 'var(--color-warn-text)' }}
              >
                {a.passed ? 'holds' : 'violated'}
              </span>
              {a.p_value != null && (
                <span className="tnum font-mono text-[11px] text-slate">p = {formatP(a.p_value)}</span>
              )}
              {a.statistic != null && (
                <span className="tnum font-mono text-[11px] text-slate">
                  stat = {Number(a.statistic).toFixed(3)}
                </span>
              )}
            </div>
            {!compact && a.note && (
              <p className="mt-0.5 text-[11.5px] leading-snug text-slate">{a.note}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
