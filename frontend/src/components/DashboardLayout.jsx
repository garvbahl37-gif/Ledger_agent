import { useEffect } from 'react'
import {
  FlaskConical, Activity, FileText, BarChart3, ShieldAlert, Terminal,
  MessageSquare, Gauge, ArrowLeft, Command, Lock, Circle,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useSession, selectSupportedCount } from '../lib/store'
import { AGENTS } from '../lib/agents'
import StatusPill from './ui/StatusPill'
import CopyButton from './ui/CopyButton'

export const NAV = [
  { id: 'setup',     label: 'Data',        icon: FlaskConical, hint: 'Load a dataset' },
  { id: 'pipeline',  label: 'Pipeline',    icon: Activity,     hint: 'Agents, live' },
  { id: 'report',    label: 'Report',      icon: FileText,     hint: 'Findings and the ledger', needsReport: true },
  { id: 'explore',   label: 'Explore',     icon: BarChart3,    hint: 'Distributions and correlations', needsReport: true },
  { id: 'adversary', label: 'Red team',    icon: ShieldAlert,  hint: 'What the auditor flagged', needsReport: true },
  { id: 'sql',       label: 'Query',       icon: Terminal,     hint: 'Ask in English, get SQL', needsReport: true },
  { id: 'ask',       label: 'Ask',         icon: MessageSquare,hint: 'Questions, answered from the ledger', needsReport: true },
  { id: 'telemetry', label: 'Telemetry',   icon: Gauge,        hint: 'Timings, tokens, self-repair' },
]

export default function DashboardLayout({ view, onNavigate, onExit, onOpenPalette, children }) {
  const running   = useSession((s) => s.running)
  const report    = useSession((s) => s.report)
  const sessionId = useSession((s) => s.sessionId)
  const hash      = useSession((s) => s.registryHash)
  const frozen    = useSession((s) => s.frozen)
  const agents    = useSession((s) => s.agents)
  const supportedCount = useSession(selectSupportedCount)
  const entryCount = report?.ledger_entries?.length ?? 0

  // ⌘K anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenPalette?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenPalette])

  const liveAgent = AGENTS.find((a) => agents[a.key]?.status === 'RUNNING')

  return (
    <div className="flex min-h-screen bg-pearl">
      {/* ── Rail ─────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-silver bg-paper lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-silver px-4">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-70"
            aria-label="Back to the overview"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-deep))', fontSize: 13 }}
            >
              L
            </span>
            <span className="text-[15px] font-bold tracking-tight text-ink">Ledger</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5" aria-label="Sections">
          {NAV.map((item) => {
            const locked = item.needsReport && !report
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active && 'bg-brand-tint',
                  !active && !locked && 'hover:bg-mist',
                  locked && 'cursor-not-allowed opacity-40',
                )}
              >
                <item.icon
                  size={15}
                  className={cn('shrink-0', active ? 'text-brand-text' : 'text-slate')}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn(
                    'block truncate text-[13px] font-medium',
                    active ? 'text-brand-text' : 'text-ink',
                  )}>
                    {item.label}
                  </span>
                </span>
                {item.id === 'pipeline' && running && (
                  <Circle size={7} fill="currentColor" className="shrink-0 animate-pulse-soft text-brand" aria-label="running" />
                )}
                {item.id === 'report' && supportedCount > 0 && (
                  <span className="tnum shrink-0 rounded-full bg-supported-tint px-1.5 text-[10px] font-semibold text-supported-text">
                    {supportedCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Registry state — the one fact that is always worth surfacing */}
        <div className="border-t border-silver p-3">
          {frozen && hash ? (
            <div className="rounded-lg bg-mist p-2.5 ring-1 ring-silver">
              <div className="flex items-center gap-1.5">
                <Lock size={11} className="text-error-text" aria-hidden="true" />
                <span className="text-[10.5px] font-semibold tracking-wide text-graphite">
                  REGISTRY FROZEN
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate">
                {entryCount || '—'} hypotheses locked before any test ran.
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <code className="truncate font-mono text-[10px] text-graphite">{hash}</code>
                <CopyButton value={hash} label="" className="px-1" size={11} />
              </div>
            </div>
          ) : (
            <p className="px-1 text-[11px] leading-snug text-slate">
              {running && liveAgent
                ? <>Running <span className="font-mono text-graphite">{liveAgent.key}</span> {liveAgent.name}…</>
                : 'The registry freezes before any test runs.'}
            </p>
          )}

          <button
            type="button"
            onClick={onOpenPalette}
            className="mt-2.5 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11.5px] text-slate transition-colors hover:text-ink"
          >
            <span className="flex items-center gap-1.5"><Command size={11} aria-hidden="true" /> Commands</span>
            <kbd className="rounded border border-silver bg-mist px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-silver bg-paper/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate transition-colors hover:bg-mist hover:text-ink lg:hidden"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">
              {NAV.find((n) => n.id === view)?.label ?? 'Ledger'}
            </h1>
            <span className="hidden truncate text-[12.5px] text-slate sm:block">
              {NAV.find((n) => n.id === view)?.hint}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {running && <StatusPill status="EXECUTING" size="sm" />}
            {report && !running && (
              <StatusPill status={report.report_validated ? 'SUPPORTED' : 'PENDING'} size="sm" />
            )}
            {sessionId && (
              <code className="hidden font-mono text-[10.5px] text-slate md:inline">
                {sessionId.slice(0, 8)}
              </code>
            )}
          </div>
        </header>

        {/* Mobile nav */}
        <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b border-silver bg-paper px-3 py-2 lg:hidden">
          {NAV.map((item) => {
            const locked = item.needsReport && !report
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  view === item.id ? 'bg-brand-tint text-brand-text' : 'text-slate',
                  locked && 'opacity-40',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
