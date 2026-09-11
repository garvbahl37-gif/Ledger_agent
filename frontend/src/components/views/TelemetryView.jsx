import { useEffect, useState } from 'react'
import {
  Gauge, Wrench, Coins, Repeat, Sparkles, History, AlertTriangle, RefreshCw, Check, X,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSession } from '../../lib/store'
import * as api from '../../lib/api'
import { formatInt, formatMs, formatDuration, relativeTime, pct } from '../../lib/format'
import AgentTimings from '../charts/AgentTimings'
import { Card, CardHeader } from '../ui/Card'
import Stat from '../ui/Stat'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import CodeBlock from '../ui/CodeBlock'

/**
 * Observability, and the loop that feeds on it.
 *
 * Every agent invocation is logged — duration, tokens, and the error text when
 * it failed. A8 reads that history and rewrites the prompts of the agents that
 * keep failing the same way, so this screen is both the diagnostic view and the
 * input to the system's own improvement.
 */
export default function TelemetryView() {
  const report    = useSession((s) => s.report)
  const telemetry = useSession((s) => s.telemetry)
  const sessionId = useSession((s) => s.sessionId)
  const loadTelemetry = useSession((s) => s.loadTelemetry)

  const [overview, setOverview] = useState(null)
  const [prompts, setPrompts] = useState(null)
  const [metaRun, setMetaRun] = useState(null)
  const [metaBusy, setMetaBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [ov, pv] = await Promise.all([
          api.getTelemetryStats().catch(() => null),
          api.getPromptVersions().catch(() => null),
        ])
        if (!alive) return
        setOverview(ov)
        setPrompts(pv)
      } catch { /* diagnostics must never break the screen */ }
    })()
    return () => { alive = false }
  }, [])

  async function triggerMeta() {
    setMetaBusy(true)
    setProblem(null)
    try {
      const res = await api.runMetaAgent()
      setMetaRun(res)
      setPrompts(await api.getPromptVersions().catch(() => prompts))
    } catch (err) {
      setProblem(err.message)
    } finally {
      setMetaBusy(false)
    }
  }

  const events = telemetry?.agent_events ?? []
  const failures = events.filter((e) => !e.success)
  const timings = report?.agent_timings

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">Telemetry</h2>
          <p className="measure mt-1.5 text-[14px] leading-relaxed text-slate">
            Wall clock, tokens and failures for every agent invocation. This is also what the
            meta-agent reads when it decides which prompts need rewriting.
          </p>
        </div>
        {sessionId && (
          <Button variant="secondary" size="sm" onClick={loadTelemetry}>
            <RefreshCw size={13} /> Refresh
          </Button>
        )}
      </header>

      {/* ── This session ────────────────────────────────────── */}
      {report ? (
        <>
          <Card className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat
              value={formatInt(report.total_tokens ?? telemetry?.total_tokens ?? 0)}
              label="Tokens" icon={Coins}
              hint="Across every model call"
            />
            <Stat
              value={timings ? formatDuration(Object.values(timings).reduce((a, b) => a + b, 0)) : '—'}
              label="Wall clock"
              hint="Reported honestly, not engineered around"
            />
            <Stat
              value={telemetry?.self_repairs ?? report.self_repairs ?? 0}
              label="Self-repairs" icon={Wrench}
              tone={(telemetry?.self_repairs ?? 0) > 0 ? 'warn' : 'default'}
              hint="Executor fixing its own code"
            />
            <Stat
              value={failures.length}
              label="Failed calls"
              tone={failures.length ? 'error' : 'supported'}
              hint={events.length ? `of ${events.length} invocations` : 'none recorded'}
            />
          </Card>

          {timings && (
            <Card className="mt-5">
              <CardHeader
                title="Where the time went"
                hint="The steps that decide what is true are the cheap ones."
              />
              <div className="mt-4">
                <AgentTimings timings={timings} />
              </div>
            </Card>
          )}

          {events.length > 0 && (
            <Card flush className="mt-5 overflow-hidden">
              <div className="border-b border-silver px-4 py-3">
                <h3 className="text-[14px] font-semibold text-ink">Every invocation</h3>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-mist">
                    <tr>
                      {['Agent', 'Result', 'Duration', 'Tokens', 'Detail'].map((h) => (
                        <th key={h} className="border-b border-silver px-3 py-2 text-left text-[11px] font-medium text-slate">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e, i) => (
                      <tr key={i} className="hover:bg-mist/60">
                        <td className="whitespace-nowrap border-b border-silver-sub px-3 py-1.5 font-mono text-[11.5px] text-ink">
                          {e.agent_name}
                        </td>
                        <td className="border-b border-silver-sub px-3 py-1.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[11.5px]',
                            e.success ? 'text-supported-text' : 'text-error-text',
                          )}>
                            {e.success
                              ? <Check size={10} strokeWidth={3} aria-hidden="true" />
                              : <X size={10} strokeWidth={3} aria-hidden="true" />}
                            {e.success ? 'ok' : 'failed'}
                          </span>
                        </td>
                        <td className="tnum whitespace-nowrap border-b border-silver-sub px-3 py-1.5 font-mono text-[11.5px] text-graphite">
                          {formatMs(e.duration_ms)}
                        </td>
                        <td className="tnum border-b border-silver-sub px-3 py-1.5 font-mono text-[11.5px] text-graphite">
                          {e.tokens_used ? formatInt(e.tokens_used) : '—'}
                        </td>
                        <td className="max-w-sm truncate border-b border-silver-sub px-3 py-1.5 text-[11.5px] text-slate">
                          {e.error_message || e.output_summary || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="mt-6">
          <EmptyState
            icon={Gauge}
            title="No session telemetry yet"
            body="Run an analysis and every agent invocation in it shows up here."
            className="py-10"
          />
        </Card>
      )}

      {/* ── Across every session ────────────────────────────── */}
      {overview && (
        <section className="mt-8">
          <h3 className="text-[17px] font-semibold tracking-tight text-ink">Across every session</h3>
          <p className="measure mt-1 text-[13.5px] leading-relaxed text-slate">
            The history the meta-agent learns from. A failure mode that keeps recurring here is what
            triggers a prompt rewrite.
          </p>

          <Card className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat value={formatInt(overview.total_sessions)} label="Sessions" />
            <Stat value={formatInt(overview.total_agent_events)} label="Agent calls" />
            <Stat
              value={overview.total_agent_events
                ? pct(overview.total_agent_events - overview.failed_agent_events, overview.total_agent_events)
                : '—'}
              label="Success rate"
              tone={overview.failed_agent_events ? 'warn' : 'supported'}
              hint={`${formatInt(overview.failed_agent_events)} failed`}
            />
            <Stat
              value={overview.total_hypotheses
                ? pct(overview.supported_hypotheses, overview.total_hypotheses)
                : '—'}
              label="Support rate"
              hint={`${formatInt(overview.supported_hypotheses)} of ${formatInt(overview.total_hypotheses)} hypotheses`}
            />
          </Card>

          {overview.failure_patterns?.length > 0 && (
            <Card className="mt-4">
              <CardHeader
                title="Recurring failures"
                hint="Grouped by agent. These are the candidates for a prompt rewrite."
              />
              <ul className="mt-3 space-y-2">
                {overview.failure_patterns.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg bg-warn-tint px-3 py-2 ring-1 ring-warn-edge">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn-text" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11.5px] font-semibold text-warn-text">
                          {f.agent_name}
                        </span>
                        <span className="tnum text-[11px] text-warn-text/80">
                          {f.count}× failed
                        </span>
                      </div>
                      {f.sample_error && (
                        <p className="mt-0.5 break-words font-mono text-[11px] leading-snug text-graphite">
                          {f.sample_error}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      )}

      {/* ── The self-improving loop ─────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-ink">The meta-agent</h3>
            <p className="measure mt-1 text-[13.5px] leading-relaxed text-slate">
              It reads the failure history above and rewrites the prompt of whichever agent keeps
              making the same mistake. Every rewrite is versioned, with the reason recorded.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={triggerMeta} loading={metaBusy}>
            {!metaBusy && <Sparkles size={13} />} Run a cycle
          </Button>
        </div>

        {problem && (
          <div className="mt-3 rounded-lg bg-error-tint px-3 py-2.5 text-[12.5px] text-error-text ring-1 ring-error-edge">
            {problem}
          </div>
        )}

        {metaRun && (
          <Card className="mt-4">
            <div className="flex items-center gap-1.5">
              <Repeat size={13} className="text-brand" aria-hidden="true" />
              <h4 className="text-[13px] font-semibold text-ink">
                {metaRun.total_improvements === 0
                  ? 'Nothing needed changing'
                  : `${metaRun.total_improvements} prompt${metaRun.total_improvements === 1 ? '' : 's'} rewritten`}
              </h4>
            </div>
            {metaRun.total_improvements === 0 ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate">
                No failure pattern in the history was frequent enough to act on.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {metaRun.improvements_made.map((imp, i) => (
                  <li key={i} className="rounded-lg bg-mist px-3 py-2.5 ring-1 ring-silver">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-brand-text">
                        {imp.agent || imp.agent_name}
                      </span>
                      {imp.version && (
                        <span className="tnum text-[11px] text-slate">v{imp.version}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-graphite">
                      {imp.rationale || imp.reason || imp.change}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {prompts?.versions?.length > 0 && (
          <Card flush className="mt-4 overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-silver px-4 py-3">
              <History size={14} className="text-slate" aria-hidden="true" />
              <h4 className="text-[14px] font-semibold text-ink">Prompt history</h4>
            </div>
            <ul className="divide-y divide-silver-sub">
              {prompts.versions.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] font-semibold text-ink">{v.agent_name}</span>
                      <span className="tnum rounded-full bg-fog px-1.5 text-[10.5px] text-slate">
                        v{v.version}
                      </span>
                      {v.is_active && (
                        <span className="rounded-full bg-supported-tint px-1.5 text-[10.5px] font-medium text-supported-text">
                          active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate">{relativeTime(v.created_at)}</span>
                  </div>
                  {v.rationale && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate">{v.rationale}</p>
                  )}
                  {v.template && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11.5px] text-brand-text hover:underline">
                        Show the template
                      </summary>
                      <div className="mt-2">
                        <CodeBlock code={v.template} lang="text" label="System prompt" maxHeight={240} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
