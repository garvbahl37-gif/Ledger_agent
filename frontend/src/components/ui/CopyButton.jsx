import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function CopyButton({ value, label = 'Copy', className, size = 13 }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value))
    } catch {
      // Clipboard is unavailable over plain http on some hosts; fall back.
      const ta = document.createElement('textarea')
      ta.value = String(value)
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* nothing more to try */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
        'text-slate transition-colors hover:bg-mist hover:text-ink',
        className,
      )}
    >
      {copied
        ? <Check size={size} strokeWidth={2.5} className="text-supported-text" aria-hidden="true" />
        : <Copy size={size} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
