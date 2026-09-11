import { cn } from '../../lib/cn'

export function Card({ className, flush, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-paper ring-1 ring-silver shadow-card',
        !flush && 'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, hint, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {hint && <p className="mt-1 text-[13px] leading-relaxed text-slate">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
