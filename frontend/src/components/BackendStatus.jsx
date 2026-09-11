import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import * as api from '../lib/api'
import { cn } from '../lib/cn'

/**
 * Whether the analysis engine is actually reachable.
 *
 * The interface deploys as a static bundle; the agents, the sandbox and the
 * statistics run on a Python service somewhere else. Without this, a visitor on
 * a hosted build gets a working-looking upload screen and a network error a
 * click later. Better to say up front what is missing and how to supply it.
 */
export default function BackendStatus({ className }) {
  const [state, setState] = useState({ status: 'checking' })

  useEffect(() => {
    let alive = true
    api.health()
      .then((h) => alive && setState({ status: 'up', health: h }))
      .catch((err) => alive && setState({ status: 'down', message: err.message }))
    return () => { alive = false }
  }, [])

  if (state.status === 'checking') {
    return (
      <p className={cn('flex items-center gap-1.5 text-[12.5px] text-slate', className)}>
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Checking for the analysis engine…
      </p>
    )
  }

  if (state.status === 'up') {
    const model = state.health?.groq_configured || state.health?.gemini_configured
    return (
      <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-supported-text', className)}>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={12} aria-hidden="true" />
          Engine connected
        </span>
        <span className="font-mono text-[11.5px] text-slate">{api.API_BASE}</span>
      </p>
    )
  }

  return (
    <div className={cn('rounded-xl bg-warn-tint p-4 ring-1 ring-warn-edge', className)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn-text" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-warn-text">
            The analysis engine isn't reachable
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-graphite">
            This page is the interface. The agents, the sandbox and the statistics run in a
            Python service, and nothing can be analysed until one is running.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-graphite">
            Run it locally:
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-paper px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-graphite ring-1 ring-silver">
{`cd backend
pip install -r requirements.txt
cp .env.example .env      # set OLLAMA_HOST or a provider key
uvicorn main:app --port 8000`}
          </pre>
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate">
            Pointing at a hosted engine instead? Set{' '}
            <code className="rounded bg-paper px-1 font-mono">VITE_API_BASE</code> to its URL and
            rebuild. Currently trying{' '}
            <code className="rounded bg-paper px-1 font-mono">{api.API_BASE}</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
