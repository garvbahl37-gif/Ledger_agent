import { Check, Loader2, AlertTriangle, Lock, Cpu, Binary } from 'lucide-react'
import { cn } from '../lib/cn'
import { formatDuration } from '../lib/format'

/**
 * One agent in the pipeline.
 *
 * The badge distinguishing deterministic from model-backed is the point of this
 * component, not decoration: the architecture's whole claim is that the steps
 * which decide what is true contain no language model, and a reader should be
 * able to verify that by looking rather than by reading the paper.
 */
export default function AgentNode({ agent, state, index, compact, onClick }) {
  const status = state?.status ?? 'IDLE'
  const running = status === 'RUNNING'
  const done = status === 'DONE'
  const warn = status === 'WARN'

  const Icon = warn ? AlertTriangle
    : done ? Check
    : running ? Loader2
    : agent.freeze ? Lock
    : agent.deterministic ? Binary
    : Cpu

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border bg-paper text-left transition-all duration-200',
        compact ? 'p-3' : 'p-4',
        running && 'border-transparent shadow-lift ring-2',
        !running && done && 'border-supported-edge',
        !running && !done && 'border-silver',
        onClick && 'hover:border-slate/30 hover:shadow-card',
        !onClick && 'cursor-default',
      )}
      style={running ? { '--tw-ring-color': agent.accent } : undefined}
    >
      {/* Accent rail — carries the agent's identity without a coloured card */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: agent.accent, opacity: status === 'IDLE' ? 0.25 : 1 }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold',
              status === 'IDLE' && 'opacity-55',
            )}
            style={{
              background: `color-mix(in srgb, ${agent.accent} 12%, white)`,
              color: agent.accent,
            }}
          >
            {agent.key}
          </span>
          <span className="text-[13.5px] font-semibold tracking-tight text-ink">{agent.name}</span>
        </div>

        <Icon
          size={14}
          strokeWidth={2.5}
          aria-hidden="true"
          className={cn(
            'mt-1 shrink-0',
            running && 'animate-spin',
            done && 'text-supported-text',
            warn && 'text-warn-text',
            !done && !warn && !running && 'text-slate/50',
            running && 'text-slate',
          )}
        />
      </div>

      {!compact && (
        <p className="mt-2 text-[12px] leading-relaxed text-slate">{agent.role}</p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide',
            agent.deterministic
              ? 'bg-supported-tint text-supported-text'
              : 'bg-fog text-graphite',
          )}
        >
          {agent.deterministic ? 'NO MODEL' : 'MODEL'}
        </span>

        {state?.durationS != null
          ? <span className="tnum font-mono text-[10px] text-slate">{formatDuration(state.durationS)}</span>
          : <span className="font-mono text-[10px] text-slate/70">
              {agent.input} → {agent.output}
            </span>}
      </div>

      {/* Live sweep while the agent holds the pipeline */}
      {running && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
          <span
            className="absolute inset-y-0 w-1/3"
            style={{ background: agent.accent, animation: 'ledger-sweep 1.2s ease-in-out infinite' }}
          />
        </span>
      )}
    </button>
  )
}
