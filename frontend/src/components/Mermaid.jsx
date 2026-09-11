import { useEffect, useId, useRef, useState } from 'react'
import Skeleton from './ui/Skeleton'

/**
 * Renders a Mermaid diagram from the query plan A9 emits.
 *
 * mermaid is large and only ever needed on this one screen, so it is imported
 * on demand. Models occasionally emit syntax mermaid rejects; that is caught
 * and the source is shown instead of an empty box, because the SQL beside it is
 * still usable.
 */
export default function Mermaid({ chart, className }) {
  const ref = useRef(null)
  const id = useId().replace(/:/g, '')
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false
    if (!chart?.trim()) return

    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          fontFamily: 'Inter, system-ui, sans-serif',
          themeVariables: {
            primaryColor: '#f0fdfa',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#99f6e4',
            lineColor: '#94a3b8',
            secondaryColor: '#f8fafc',
            tertiaryColor: '#ffffff',
            fontSize: '13px',
          },
        })

        const cleaned = chart.replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/, '').trim()
        const { svg } = await mermaid.render(`m-${id}`, cleaned)
        if (cancelled || !ref.current) return
        ref.current.innerHTML = svg
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()

    return () => { cancelled = true }
  }, [chart, id])

  if (!chart?.trim()) return null

  if (state === 'error') {
    return (
      <pre className="overflow-auto rounded-lg bg-mist px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-slate ring-1 ring-silver">
        {chart}
      </pre>
    )
  }

  return (
    <div className={className}>
      {state === 'loading' && <Skeleton className="h-40 w-full" />}
      <div
        ref={ref}
        className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
        style={{ display: state === 'ready' ? 'flex' : 'none' }}
      />
    </div>
  )
}
