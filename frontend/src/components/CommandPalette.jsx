import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CornerDownLeft, RotateCcw, FileDown, NotebookPen, Copy } from 'lucide-react'
import { cn } from '../lib/cn'
import { useSession } from '../lib/store'
import { NAV } from './DashboardLayout'
import * as api from '../lib/api'

/** ⌘K. Navigation plus the handful of actions worth reaching without the mouse. */
export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  const report    = useSession((s) => s.report)
  const sessionId = useSession((s) => s.sessionId)
  const reset     = useSession((s) => s.reset)

  const commands = useMemo(() => {
    const nav = NAV
      .filter((n) => !n.needsReport || report)
      .map((n) => ({
        id: `go-${n.id}`,
        label: `Go to ${n.label}`,
        hint: n.hint,
        icon: n.icon,
        run: () => onNavigate(n.id),
      }))

    const actions = []
    if (report) {
      actions.push(
        {
          id: 'export-html', label: 'Download the report', hint: 'Standalone HTML',
          icon: FileDown, run: () => window.open(api.reportUrl(sessionId), '_blank'),
        },
        {
          id: 'export-nb', label: 'Download the notebook', hint: 'Jupyter .ipynb',
          icon: NotebookPen, run: () => window.open(api.notebookUrl(sessionId), '_blank'),
        },
        {
          id: 'copy-hash', label: 'Copy the reproducibility hash', hint: report.reproducibility_hash,
          icon: Copy, run: () => navigator.clipboard?.writeText(report.reproducibility_hash ?? ''),
        },
      )
    }
    actions.push({
      id: 'reset', label: 'Start a new analysis', hint: 'Clears this session',
      icon: RotateCcw, run: () => { reset(); onNavigate('setup') },
    })

    return [...nav, ...actions]
  }, [report, sessionId, onNavigate, reset])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = results[cursor]
        if (cmd) { cmd.run(); onClose() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, cursor, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Commands"
    >
      <div
        className="animate-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="animate-rise relative w-full max-w-lg overflow-hidden rounded-xl bg-paper shadow-float ring-1 ring-silver">
        <div className="flex items-center gap-2.5 border-b border-silver px-4">
          <Search size={15} className="shrink-0 text-slate" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            aria-label="Search commands"
            className="flex-1 bg-transparent py-3.5 text-[14px] text-ink outline-none placeholder:text-slate/60"
          />
          <kbd className="shrink-0 rounded border border-silver bg-mist px-1.5 py-0.5 font-mono text-[10px] text-slate">
            esc
          </kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-slate">
              Nothing matches “{query}”.
            </li>
          ) : (
            results.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { cmd.run(); onClose() }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                    i === cursor ? 'bg-brand-tint' : 'hover:bg-mist',
                  )}
                >
                  <cmd.icon
                    size={14}
                    className={cn('shrink-0', i === cursor ? 'text-brand-text' : 'text-slate')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn(
                      'block truncate text-[13px] font-medium',
                      i === cursor ? 'text-brand-text' : 'text-ink',
                    )}>
                      {cmd.label}
                    </span>
                    {cmd.hint && (
                      <span className="block truncate text-[11.5px] text-slate">{cmd.hint}</span>
                    )}
                  </span>
                  {i === cursor && (
                    <CornerDownLeft size={12} className="shrink-0 text-brand-text" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
