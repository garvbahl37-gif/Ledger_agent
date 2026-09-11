import { cn } from '../../lib/cn'

/** An empty screen is an invitation to act, so it always carries the action. */
export default function EmptyState({ icon: Icon, title, body, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-mist ring-1 ring-silver">
          <Icon size={19} className="text-slate" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {body && <p className="measure mt-1.5 text-[13.5px] leading-relaxed text-slate">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
