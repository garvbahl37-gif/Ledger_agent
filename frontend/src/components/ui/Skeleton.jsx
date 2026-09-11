import { cn } from '../../lib/cn'

export default function Skeleton({ className }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-fog', className)} aria-hidden="true">
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
          animation: 'ledger-sweep 1.4s ease-in-out infinite',
        }}
      />
    </div>
  )
}
