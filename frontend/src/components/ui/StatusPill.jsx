import { Check, X, AlertTriangle, CircleDashed, Loader2, Lock } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * A verdict badge.
 *
 * Status is never communicated by color alone. #059669 (supported) and #e11d48
 * (error) sit at ΔE 5.8 under deuteranopia — indistinguishable for roughly 8%
 * of men. So the icon and the word are not decoration here, they are the
 * accessible channel, and there is deliberately no prop to switch them off.
 */

const VARIANTS = {
  SUPPORTED: { label: 'Supported', Icon: Check,
    cls: 'bg-supported-tint text-supported-text ring-supported-edge' },
  REJECTED:  { label: 'Not supported', Icon: X,
    cls: 'bg-rejected-tint text-rejected-text ring-rejected-edge' },
  ERROR:     { label: 'Failed to run', Icon: AlertTriangle,
    cls: 'bg-error-tint text-error-text ring-error-edge' },
  PENDING:   { label: 'Pending', Icon: CircleDashed,
    cls: 'bg-mist text-slate ring-silver' },
  EXECUTING: { label: 'Running', Icon: Loader2,
    cls: 'bg-brand-tint text-brand-text ring-brand-edge', spin: true },
  FROZEN:    { label: 'Frozen', Icon: Lock,
    cls: 'bg-error-tint text-error-text ring-error-edge' },
}

export default function StatusPill({ status, size = 'md', className }) {
  const v = VARIANTS[status] ?? VARIANTS.PENDING
  const { Icon } = v
  const sm = size === 'sm'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        sm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        v.cls,
        className,
      )}
    >
      <Icon
        size={sm ? 11 : 12}
        strokeWidth={2.5}
        aria-hidden="true"
        className={cn('shrink-0', v.spin && 'animate-spin')}
      />
      {v.label}
    </span>
  )
}

export { VARIANTS as STATUS_VARIANTS }
