import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, ChevronRight, Square, RotateCcw, ArrowRight, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSession } from '../../lib/store'
import { AGENTS } from '../../lib/agents'
import { formatDuration } from '../../lib/format'
import AgentNode from '../AgentNode'
import Button from '../ui/Button'
import { Card } from '../ui/Card'
import CopyButton from '../ui/CopyButton'

/** The stream carries emoji status prefixes; strip them and keep the meaning. */
function cleanMessage(msg = '') {
  return msg.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️✅⚠️❌🔒🎉]+\s*/u, '')
}

function tone(msg = '') {
  if (msg.startsWith('✅') || msg.startsWith('🎉')) return 'done'
  if (msg.startsWith('⚠️')) return 'warn'
  if (msg.startsWith('❌')) return 'error'
  return 'info'
}

export default function LivePipelineView({ onDone }) {
  const running   = useSession((s) => s.running)
  const log       = useSession((s) => s.log)
  const agents    = useSession((s) => s.agents)
  const hypotheses= useSession((s) => s.hypotheses)
  const hash      = useSession((s) => s.registryHash)
  const frozen    = useSession((s) => s.frozen)
  const error     = useSession((s) => s.error)
  const report    = useSession((s) => s.report)
  const source    = useSession((s) => s.source)
  const cancel    = useSession((s) => s.cancel)
  const reset     = useSession((s) => s.reset)

  const feedRef = useRef(null)
  const [startedAt] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 200)
    return () => clearInterval(t)
  }, [running, startedAt])

  // Follow the feed, but never steal the scroll if the reader has moved up.
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (atBottom) el.scrollTop = el.scrollHeight
  }, [log])

  const done = useMemo(
    () => AGENTS.filter((a) => agents[a.key]?.status === 'DONE').length,
    [agents],
  )
  const progress = Math.round((done / AGENTS.length) * 100)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">
            {running ? 'The pipeline is running' : error ? 'The pipeline stopped' : 'Analysis complete'}
          </h2>
          <p className="mt-1 text-[13.5px] text-slate">
            {source?.name && <span className="font-mono text-[12.5px] text-graphite">{source.name}</span>}
            {source?.name && ' · '}
            <span className="tnum">{formatDuration(running ? elapsed : (report?.agent_timings ? Object.values(report.agent_timings).reduce((a, b) => a + b, 0) : elapsed))}</span>
            {' · '}{done} of {AGENTS.length} agents finished
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {running && (
            <Button variant="secondary" size="sm" onClick={cancel}>
              <Square size={13} /> Stop
            </Button>
          )}
          {!running && report && (
            <Button variant="primary" size="sm" onClick={() => onDone?.()}>
              Read the report <ArrowRight size={14} />
            </Button>
          )}
          {!running && error && (
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw size={13} /> Start over
            </Button>
          )}
        </div>
      </div>

      {/* Progress — a meter, not a chart */}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-fog">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: error ? 'var(--color-error)' : 'var(--color-brand)',
          }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Pipeline progress"
        />
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-error-tint p-4 ring-1 ring-error-edge">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-error-text" aria-hidden="true" />
          <div>
            <p className="text-[13.5px] font-semibold text-error-text">The run did not finish</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-error-text/90">{error}</p>
          </div>
        </div>
      )}

      {/* ── Agents ──────────────────────────────────────────── */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENTS.map((agent) => (
          <AgentNode key={agent.key} agent={agent} state={agents[agent.key]} compact />
        ))}
      </div>

      {/* ── The freeze ──────────────────────────────────────── */}
      {frozen && hash && (
        <div className="animate-rise mt-5 overflow-hidden rounded-xl bg-ink">
          <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Lock size={16} className="text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-white">Registry frozen</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/55">
                {hypotheses.length || '—'} hypotheses are locked. Nothing can be added now, so the
                denominator of the correction was fixed before any result was seen.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
              <code className="font-mono text-[11.5px] text-brand-edge">{hash}</code>
              <CopyButton value={hash} label="" className="px-0.5 text-white/60 hover:bg-white/10 hover:text-white" size={11} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* ── Feed ───────────────────────────────────────────── */}
        <Card flush className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-silver px-4 py-2.5">
            <h3 className="text-[13px] font-semibold text-ink">Activity</h3>
            {running && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand" />
                live
              </span>
            )}
          </div>

          <div ref={feedRef} className="max-h-[380px] overflow-y-auto px-4 py-3">
            {log.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-slate">Waiting for the first event…</p>
            ) : (
              <ol className="space-y-2">
                {log.map((entry) => {
                  const t = tone(entry.message)
                  return (
                    <li key={entry.id} className="animate-fade flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            t === 'done' ? 'var(--color-supported)'
                            : t === 'warn' ? 'var(--color-warn)'
                            : t === 'error' ? 'var(--color-error)'
                            : 'var(--color-muted-mark)',
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        {entry.agentKey && (
                          <span className="mr-1.5 font-mono text-[10.5px] font-semibold text-slate">
                            {entry.agentKey}
                          </span>
                        )}
                        <span className={cn(
                          'text-[12.5px] leading-relaxed',
                          t === 'error' ? 'text-error-text' : 'text-graphite',
                        )}>
                          {cleanMessage(entry.message)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 font-mono text-[10px] text-slate/60">
                        {entry.at.toLocaleTimeString('en-GB', { hour12: false })}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </Card>

        {/* ── Registry as it fills ───────────────────────────── */}
        <Card flush className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-silver px-4 py-2.5">
            <h3 className="text-[13px] font-semibold text-ink">The registry</h3>
            <span className="tnum text-[11px] text-slate">
              {hypotheses.length > 0 ? `${hypotheses.length} registered` : 'not yet proposed'}
            </span>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {hypotheses.length === 0 ? (
              <p className="px-4 py-12 text-center text-[12.5px] leading-relaxed text-slate">
                The proposer reads the profile first.<br />Hypotheses appear here before they are locked.
              </p>
            ) : (
              <ul className="divide-y divide-silver-sub">
                {hypotheses.map((h) => (
                  <li key={h.id} className="animate-fade flex gap-2.5 px-4 py-2.5">
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-text">
                      {h.id}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
                      {h.statement}
                    </span>
                    <ChevronRight size={13} className="mt-0.5 shrink-0 text-slate/40" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
