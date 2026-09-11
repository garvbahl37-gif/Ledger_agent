import { useState, useId } from 'react'
import { ChevronRight, Wrench, User, Quote } from 'lucide-react'
import { cn } from '../lib/cn'
import { formatP, formatNum, effectMagnitude, pVerdict } from '../lib/format'
import StatusPill from './ui/StatusPill'
import CodeBlock from './ui/CodeBlock'
import CopyButton from './ui/CopyButton'
import AssumptionMatrix from './charts/AssumptionMatrix'
import PlotlyChart from './charts/PlotlyChart'

/**
 * One ledger entry — the receipt behind a claim.
 *
 * Collapsed it is a verdict. Expanded it is the whole chain: the code that ran,
 * the assumptions that were checked, the test those assumptions selected, the
 * effect size, and the licensed sentence. That chain is the product; a claim
 * you cannot open is a claim you have to take on trust.
 */

function Field({ label, children, mono = true }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-medium tracking-wide text-slate">{label}</dt>
      <dd className={cn(
        'mt-0.5 text-[13px] text-ink',
        mono && 'tnum font-mono text-[12.5px]',
      )}>
        {children}
      </dd>
    </div>
  )
}

export default function LedgerCard({ entry, defaultOpen = false, highlighted, onOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  const r = entry.statistical_result
  const attempt = entry.execution_attempts?.at?.(-1)
  const code = attempt?.code ?? entry.code_executed
  const repairs = entry.repair_count ?? 0
  const rejected = entry.status === 'REJECTED'

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) onOpen?.(entry.id)
  }

  return (
    <article
      id={`ledger-${entry.id}`}
      className={cn(
        'scroll-mt-20 overflow-hidden rounded-xl bg-paper ring-1 transition-all duration-200',
        highlighted ? 'ring-2 ring-brand shadow-lift' : 'ring-silver',
        open && !highlighted && 'shadow-card',
      )}
    >
      {/* ── Collapsed ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-mist/60"
      >
        <ChevronRight
          size={15}
          aria-hidden="true"
          className={cn(
            'mt-0.5 shrink-0 text-slate transition-transform duration-200',
            open && 'rotate-90',
          )}
        />

        <span className="shrink-0 pt-px font-mono text-[11.5px] font-semibold text-slate">
          {entry.id}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn(
            'block text-[13.5px] leading-snug',
            rejected ? 'text-slate' : 'text-ink',
          )}>
            {entry.statement}
          </span>

          {r && (
            <span className="tnum mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate">
              <span>{r.test_name}</span>
              <span>p<sub>adj</sub> {formatP(r.fdr_adjusted_p_value ?? r.raw_p_value)}</span>
              {r.effect_size != null && (
                <span>
                  effect {formatNum(r.effect_size, 2)}
                  {' '}<span className="text-slate/70">
                    ({effectMagnitude(r.effect_size_label, r.effect_size)})
                  </span>
                </span>
              )}
            </span>
          )}
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={entry.status} size="sm" />
          <span className="flex items-center gap-1.5">
            {entry.user_defined && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate" title="You wrote this one">
                <User size={9} aria-hidden="true" /> yours
              </span>
            )}
            {repairs > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-warn-text"
                title={`The executor repaired its own code ${repairs} time${repairs > 1 ? 's' : ''}`}
              >
                <Wrench size={9} aria-hidden="true" /> {repairs}
              </span>
            )}
          </span>
        </span>
      </button>

      {/* ── Expanded: the receipt ─────────────────────────── */}
      {open && (
        <div id={panelId} className="animate-fade border-t border-silver-sub bg-mist/40 px-4 py-4">
          {/* The licensed sentence — the only text the reporter may use */}
          {r?.licensed_text && (
            <figure className="m-0 mb-4 rounded-lg border-l-2 border-brand bg-paper py-3 pl-3.5 pr-3 ring-1 ring-silver">
              <div className="flex items-center gap-1.5">
                <Quote size={10} className="text-brand" aria-hidden="true" />
                <figcaption className="text-[10.5px] font-medium tracking-wide text-brand-text">
                  LICENSED TEXT
                </figcaption>
              </div>
              <blockquote className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                {r.licensed_text}
              </blockquote>
              <p className="mt-1.5 text-[11px] leading-snug text-slate">
                The statistician wrote this sentence. The reporter may use it and may not
                strengthen it.
              </p>
            </figure>
          )}

          {r ? (
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-4">
              <Field label="TEST SELECTED" mono={false}>
                <span className="font-medium">{r.test_name}</span>
              </Field>
              <Field label="STATISTIC">{formatNum(r.statistic, 3)}</Field>
              <Field label="RAW p">
                {formatP(r.raw_p_value)}
                <span className="ml-1 text-[10.5px] text-slate">{pVerdict(r.raw_p_value, r.alpha)}</span>
              </Field>
              <Field label={`FDR-ADJUSTED p (q=${r.alpha ?? 0.05})`}>
                <span className={rejected ? 'text-slate' : 'text-supported-text'}>
                  {formatP(r.fdr_adjusted_p_value)}
                </span>
              </Field>
              {r.effect_size != null && (
                <Field label="EFFECT SIZE">
                  {formatNum(r.effect_size, 3)}
                  <span className="ml-1 font-sans text-[11px] text-slate">
                    {effectMagnitude(r.effect_size_label, r.effect_size)}
                  </span>
                </Field>
              )}
              {entry.columns_involved?.length > 0 && (
                <Field label="COLUMNS" mono={false}>
                  <span className="flex flex-wrap gap-1">
                    {entry.columns_involved.map((c) => (
                      <code key={c} className="rounded bg-fog px-1.5 py-0.5 font-mono text-[11px] text-graphite">
                        {c}
                      </code>
                    ))}
                  </span>
                </Field>
              )}
            </dl>
          ) : (
            <p className="text-[12.5px] leading-relaxed text-slate">
              {entry.status === 'ERROR'
                ? 'The code for this hypothesis could not be made to run, so no verdict was reached. It stays in the registry and still counts toward the correction.'
                : 'No statistical result was recorded for this entry.'}
            </p>
          )}

          {/* Assumptions — why this test and not another */}
          {r?.assumptions?.length > 0 && (
            <section className="mt-4 border-t border-silver-sub pt-3.5">
              <h4 className="mb-2 text-[10.5px] font-medium tracking-wide text-slate">
                ASSUMPTIONS CHECKED — THESE CHOSE THE TEST
              </h4>
              <AssumptionMatrix assumptions={r.assumptions} />
            </section>
          )}

          {/* The code */}
          {code && (
            <section className="mt-4 border-t border-silver-sub pt-3.5">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10.5px] font-medium tracking-wide text-slate">
                  CODE EXECUTED
                </h4>
                {repairs > 0 && (
                  <span className="text-[10.5px] text-warn-text">
                    repaired {repairs}× against real tracebacks
                  </span>
                )}
              </div>
              <CodeBlock code={code} lang="python" maxHeight={280} />
            </section>
          )}

          {/* Raw returns */}
          {entry.raw_data && Object.keys(entry.raw_data).length > 0 && (
            <section className="mt-4 border-t border-silver-sub pt-3.5">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10.5px] font-medium tracking-wide text-slate">WHAT IT RETURNED</h4>
                <CopyButton value={JSON.stringify(entry.raw_data, null, 2)} label="Copy JSON" />
              </div>
              <pre className="tnum max-h-44 overflow-auto rounded-lg bg-paper px-3 py-2 font-mono text-[11.5px] leading-relaxed text-graphite ring-1 ring-silver">
                {JSON.stringify(entry.raw_data, null, 2)}
              </pre>
            </section>
          )}

          {entry.chart_spec && (
            <section className="mt-4 border-t border-silver-sub pt-3.5">
              <PlotlyChart spec={entry.chart_spec} height={280} />
            </section>
          )}
        </div>
      )}
    </article>
  )
}
