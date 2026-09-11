import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'

/**
 * The boot sequence.
 *
 * This is the single orchestrated motion moment in the product — everything
 * after it is quiet. It dramatises the one thing that makes Ledger different
 * from every other chat-with-your-CSV tool: the registry closing. Agents ignite
 * in order, the hash resolves character by character, and the lock snaps. Then
 * it gets out of the way.
 *
 * Rules it holds to: under 2.6s, skippable with any key or click, and reduced
 * to a single fade when the viewer has asked for less motion.
 */

const STAGES = [
  { key: 'A0', label: 'Cleaning',    accent: 'var(--color-a0)' },
  { key: 'A1', label: 'Profiling',   accent: 'var(--color-a1)' },
  { key: 'A2', label: 'Proposing',   accent: 'var(--color-a2)' },
  { key: 'A3', label: 'Freezing',    accent: 'var(--color-a3)', freeze: true },
  { key: 'A4', label: 'Executing',   accent: 'var(--color-a4)' },
  { key: 'A5', label: 'Adjudicating',accent: 'var(--color-a5)' },
]

const HEX = '0123456789abcdef'
const TARGET_HASH = 'c0dfad2526bdd08a'

export default function BootSequence({ onDone }) {
  const [step, setStep] = useState(-1)
  const [leaving, setLeaving] = useState(false)
  const [hash, setHash] = useState('')
  const doneRef = useRef(false)

  const reduced = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // One place that ends the sequence, however it ends.
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDone?.(), 260)
      return () => clearTimeout(t)
    }

    const timers = []
    STAGES.forEach((_, i) => {
      timers.push(setTimeout(() => setStep(i), 180 + i * 230))
    })
    timers.push(setTimeout(() => setLeaving(true), 180 + STAGES.length * 230 + 460))
    timers.push(setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone?.() } },
      180 + STAGES.length * 230 + 860))

    return () => timers.forEach(clearTimeout)
  }, [onDone, reduced])

  // The hash resolves out of noise as the freeze lands.
  useEffect(() => {
    if (reduced || step < 3) return
    let frame = 0
    const id = setInterval(() => {
      frame += 1
      const settled = Math.min(Math.floor(frame / 1.6), TARGET_HASH.length)
      setHash(
        TARGET_HASH.slice(0, settled) +
        Array.from({ length: TARGET_HASH.length - settled },
          () => HEX[Math.floor(Math.random() * 16)]).join(''),
      )
      if (settled >= TARGET_HASH.length) clearInterval(id)
    }, 34)
    return () => clearInterval(id)
  }, [step, reduced])

  // Any key or click skips.
  useEffect(() => {
    const skip = () => { if (!doneRef.current) { doneRef.current = true; onDone?.() } }
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [onDone])

  if (reduced) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-ink',
        'transition-opacity duration-400 ease-out',
        leaving && 'pointer-events-none opacity-0',
      )}
      role="status"
      aria-label="Starting Ledger"
    >
      {/* A faint rule grid — the ledger paper, barely there */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)',
        }}
      />

      <div className="relative flex flex-col items-center px-6">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[19px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-deep))',
              animation: 'ledger-rise 500ms var(--ease-out) both',
            }}
          >
            L
          </span>
          <span
            className="text-[30px] font-bold tracking-[-0.04em] text-white"
            style={{ animation: 'ledger-rise 500ms var(--ease-out) 80ms both' }}
          >
            Ledger
          </span>
        </div>

        <p
          className="mt-3 text-center text-[13.5px] leading-relaxed text-white/45"
          style={{ animation: 'ledger-rise 500ms var(--ease-out) 160ms both' }}
        >
          The model proposes. Statistics decides.
        </p>

        {/* The pipeline igniting */}
        <div className="mt-10 flex items-center gap-0">
          {STAGES.map((s, i) => {
            const lit = step >= i
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex w-[58px] flex-col items-center gap-2">
                  <span
                    className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      background: lit ? s.accent : 'rgba(255,255,255,0.16)',
                      boxShadow: lit ? `0 0 14px ${s.accent}` : 'none',
                      transform: lit ? 'scale(1)' : 'scale(0.65)',
                    }}
                  >
                    {s.freeze && lit && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: `1.5px solid ${s.accent}`,
                          animation: 'boot-ring 700ms var(--ease-out) both',
                        }}
                      />
                    )}
                  </span>
                  <span
                    className="font-mono text-[9.5px] tracking-wide transition-colors duration-300"
                    style={{ color: lit ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.24)' }}
                  >
                    {s.key}
                  </span>
                  <span
                    className="text-[9.5px] transition-opacity duration-300"
                    style={{ color: 'rgba(255,255,255,0.4)', opacity: lit ? 1 : 0 }}
                  >
                    {s.label}
                  </span>
                </div>

                {i < STAGES.length - 1 && (
                  <span className="relative -mt-6 h-px w-4 bg-white/12">
                    <span
                      className="absolute inset-y-0 left-0 transition-all duration-300 ease-out"
                      style={{
                        width: step > i ? '100%' : '0%',
                        background: 'rgba(255,255,255,0.38)',
                      }}
                    />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* The freeze resolving */}
        <div className="mt-9 h-5">
          {step >= 3 && (
            <div
              className="flex items-center gap-2"
              style={{ animation: 'ledger-fade 300ms var(--ease-out) both' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" stroke="var(--color-a3)" strokeWidth="2.5" />
                <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="var(--color-a3)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-[11px] tracking-wide text-white/45">
                registry frozen ·{' '}
                <span className="text-brand-edge">{hash || '················'}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes boot-ring {
          from { transform: scale(1);   opacity: 0.9; }
          to   { transform: scale(4.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
