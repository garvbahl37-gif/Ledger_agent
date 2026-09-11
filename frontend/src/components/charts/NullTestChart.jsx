import { useEffect, useRef, useState } from 'react'

/**
 * Figure 1 from the synopsis: what each system claims to find in a table that
 * contains nothing.
 *
 * Two things this chart has to be honest about, and both are load-bearing:
 *
 *  1. The numbers are PREDICTED, not measured. The synopsis states them in
 *     advance so the project can be judged against a prediction rather than a
 *     story told afterwards. So the bars are drawn as outlines, not fills —
 *     the same convention the paper uses — and the caption says so plainly.
 *     Filling them in would be the exact sin the product exists to prevent.
 *  2. Ground truth is zero, and it is drawn, so "Ledger: 0" reads as hitting
 *     the target rather than as failing to find anything.
 *
 * Form: magnitude comparison against a baseline → bars with emphasis encoding
 * (the subject in hue, the comparisons in grey), every bar direct-labelled.
 */

const SERIES = [
  { label: 'Single prompt',        sub: 'no execution',          value: 14 },
  { label: '+ code execution',     sub: 'what agents do today',  value: 11 },
  { label: '+ effect size',        sub: 'magnitude reported',    value: 6  },
  { label: 'Ledger',               sub: 'full discipline',       value: 0, subject: true },
]

const MAX = 16

export default function NullTestChart() {
  const [shown, setShown] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect() } },
      { threshold: 0.35 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between mb-[14px]">
        <span className="text-[10.5px] font-medium tracking-[0.08em] text-[#94a3b8]">
          FINDINGS CLAIMED
        </span>
        <span className="text-[11px] text-[#64748b]">
          ground truth <span className="font-mono font-semibold text-[#0d9488]">0</span>
        </span>
      </div>

      <ul className="m-0 p-0 list-none space-y-[13px]">
        {SERIES.map((s, i) => {
          const pct = (s.value / MAX) * 100
          const isSubject = s.subject
          const accent = isSubject ? '#0d9488' : '#94a3b8'

          return (
            <li key={s.label} className="flex items-center gap-[12px]">
              <span className="w-[112px] shrink-0 text-right">
                <span className={`block text-[12px] leading-[1.25] ${isSubject ? 'font-semibold text-[#0f172a]' : 'font-medium text-[#475569]'}`}>
                  {s.label}
                </span>
                <span className="block text-[10px] text-[#94a3b8] leading-[1.3]">{s.sub}</span>
              </span>

              <span className="relative flex-1 h-[22px]">
                {/* Zero baseline — the target, not the axis */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-[#0d9488]"
                />
                {s.value > 0 ? (
                  <span
                    className="absolute left-0 top-[3px] bottom-[3px] rounded-[4px]"
                    style={{
                      width: shown ? `${pct}%` : '0%',
                      border: `1.5px solid ${accent}`,
                      background: `repeating-linear-gradient(135deg, ${accent}1f 0 5px, transparent 5px 10px)`,
                      transition: `width 900ms cubic-bezier(0.16,1,0.3,1) ${i * 110}ms`,
                    }}
                  />
                ) : (
                  <span
                    className="absolute left-[4px] top-1/2 -translate-y-1/2 flex items-center gap-[6px]"
                    style={{
                      opacity: shown ? 1 : 0,
                      transition: `opacity 500ms ease ${i * 110 + 300}ms`,
                    }}
                  >
                    <span className="w-[16px] h-[16px] rounded-full bg-[#0d9488] flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" stroke="white" strokeWidth="3.5"
                              strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-[11.5px] font-medium text-[#0f766e]">
                      reports nothing, correctly
                    </span>
                  </span>
                )}
              </span>

              <span
                className={`w-[26px] shrink-0 text-right font-mono text-[13px] tabular-nums ${isSubject ? 'font-bold text-[#0d9488]' : 'text-[#64748b]'}`}
                style={{ opacity: shown ? 1 : 0, transition: `opacity 400ms ease ${i * 110 + 500}ms` }}
              >
                {s.value}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
