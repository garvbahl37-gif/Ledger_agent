import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary:
    'bg-brand-text text-white shadow-hair hover:bg-brand-deep active:bg-brand-deep disabled:bg-slate/40',
  secondary:
    'bg-paper text-ink ring-1 ring-inset ring-silver shadow-hair hover:bg-mist hover:ring-slate/30',
  ghost:
    'text-slate hover:text-ink hover:bg-mist',
  danger:
    'bg-error-text text-white shadow-hair hover:brightness-110',
  quiet:
    'text-brand-text hover:bg-brand-tint',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 justify-center rounded-lg',
}

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 size={15} className="animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  )
})

export default Button
