/**
 * Formatting for statistical output.
 * Every function here exists because a naive toFixed() lies about the data:
 * p = 0.00000012 must not render as "0.00", and n = 7032 must not render
 * as "7032" in a column beside "412".
 */

/** p-values: scientific notation below 1e-3, three decimals above. */
export function formatP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return '—'
  if (p === 0) return '< 1e-300'
  if (p < 0.001) {
    const exp = Math.floor(Math.log10(p))
    const mantissa = (p / Math.pow(10, exp)).toFixed(1)
    return `${mantissa}e${exp}`
  }
  return p.toFixed(3)
}

/** The threshold comparison, stated rather than implied by color. */
export function pVerdict(p, alpha = 0.05) {
  if (p === null || p === undefined) return ''
  return p < alpha ? `< ${alpha}` : `≥ ${alpha}`
}

export function formatNum(n, digits = 3) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs < 0.001 || abs >= 1e7)) return n.toExponential(2)
  if (Number.isInteger(n)) return n.toLocaleString('en-US')
  return n.toFixed(digits)
}

export function formatInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function formatMs(ms) {
  if (ms === null || ms === undefined) return '—'
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}

/** Cohen's conventions. Magnitude without significance is not a finding. */
export function effectMagnitude(label, value) {
  if (label) return label
  if (value === null || value === undefined) return '—'
  const a = Math.abs(value)
  if (a < 0.2) return 'negligible'
  if (a < 0.5) return 'small'
  if (a < 0.8) return 'medium'
  return 'large'
}

export function truncate(str, n = 80) {
  if (!str) return ''
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}

export function relativeTime(iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = (Date.now() - then) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function pct(part, whole) {
  if (!whole) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}
