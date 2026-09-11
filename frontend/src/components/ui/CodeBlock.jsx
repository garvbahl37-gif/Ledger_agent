import { useMemo } from 'react'
import { tokenize, TOKEN_CLASS } from '../../lib/highlight'
import { cn } from '../../lib/cn'
import CopyButton from './CopyButton'

/**
 * The code that produced a number. In this product it is evidence, not
 * illustration, so it is always shown in full and always copyable.
 */
export default function CodeBlock({ code, lang = 'python', label, className, maxHeight = 380 }) {
  const lines = useMemo(() => {
    const src = (code ?? '').replace(/\n+$/, '')
    return src.split('\n').map((line) => tokenize(line, lang))
  }, [code, lang])

  if (!code) return null

  return (
    <div className={cn('overflow-hidden rounded-lg ring-1 ring-silver bg-mist', className)}>
      <div className="flex items-center justify-between border-b border-silver-sub bg-paper/60 px-3 py-1.5">
        <span className="font-mono text-[10.5px] font-medium tracking-wide text-slate">
          {label ?? (lang === 'sql' ? 'SQL' : 'Python · pandas')}
        </span>
        <CopyButton value={code} label="Copy" />
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="px-3 py-2.5 font-mono text-[12.5px] leading-[1.65]">
          <code>
            {lines.map((tokens, i) => (
              <div key={i} className="flex">
                <span
                  aria-hidden="true"
                  className="mr-3 w-6 shrink-0 select-none text-right text-slate/45"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 whitespace-pre-wrap break-words">
                  {tokens.length === 0 ? ' ' : tokens.map((t, j) => (
                    <span key={j} className={TOKEN_CLASS[t.type]}>{t.value}</span>
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
