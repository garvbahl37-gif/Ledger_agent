/**
 * The agent roster — one source of truth for the whole UI.
 *
 * `deterministic` is the most load-bearing field here: it drives the badge that
 * tells a reader whether a model was involved in a step. Per the architecture,
 * the agents that decide what is true contain no language model, and the UI has
 * to make that legible at a glance.
 */

export const AGENTS = [
  {
    key: 'A0', stage: 'A0_JANITOR', name: 'Janitor', accent: 'var(--color-a0)',
    role: 'Type coercion, deduplication and rule-based domain annotation.',
    deterministic: true, nature: 'Deterministic',
    input: 'Raw CSV', output: 'cleaned_df',
  },
  {
    key: 'A1', stage: 'A1_PROFILER', name: 'Profiler', accent: 'var(--color-a1)',
    role: 'Marginal summaries only — types, cardinality, missingness, outliers. Deliberately never sees relationships, so the proposer cannot peek.',
    deterministic: true, nature: 'Deterministic',
    input: 'cleaned_df', output: 'profile_json',
  },
  {
    key: 'A2', stage: 'A2_PROPOSER', name: 'Proposer', accent: 'var(--color-a2)',
    role: 'Reads the profile and proposes testable hypotheses in natural language.',
    deterministic: false, nature: 'Model + RAG',
    input: 'profile_json', output: 'hypotheses',
  },
  {
    key: 'A3', stage: 'A3_REGISTRAR', name: 'Registrar', accent: 'var(--color-a3)',
    role: 'Freezes the registry and hashes it. Nothing can be added after this, so the denominator of the correction is fixed before any result is seen.',
    deterministic: true, nature: 'Freeze point', freeze: true,
    input: 'hypotheses', output: 'sha256',
  },
  {
    key: 'A4', stage: 'A4_EXECUTOR', name: 'Executor', accent: 'var(--color-a4)',
    role: 'Writes pandas, runs it sandboxed, repairs against real tracebacks up to three times.',
    deterministic: false, nature: 'Model + ReAct',
    input: 'registry', output: 'raw_data',
  },
  {
    key: 'A5', stage: 'A5_STATISTICIAN', name: 'Statistician', accent: 'var(--color-a5)',
    role: 'Checks assumptions, selects the test from what it found, computes effect sizes, applies Benjamini–Hochberg once across the whole family.',
    deterministic: true, nature: 'Deterministic',
    input: 'raw_data', output: 'ledger_entry',
  },
  {
    key: 'A6', stage: 'A6_REPORTER', name: 'Reporter', accent: 'var(--color-a6)',
    role: 'Writes the prose, constrained to licensed text. A sentence with no ledger entry cannot be written.',
    deterministic: false, nature: 'Model',
    input: 'licensed_text', output: 'report',
  },
  {
    key: 'A7', stage: 'A7_ADVERSARY', name: 'Adversary', accent: 'var(--color-a7)',
    role: 'Red-teams the draft for causal language, overstated effects and phantom findings. Sends it back to be rewritten.',
    deterministic: false, nature: 'Model · red team',
    input: 'report', output: 'verdict',
  },
]

/** Runs alongside the main pipeline rather than in sequence. */
export const SIDE_AGENTS = [
  { key: 'A10', stage: 'A10_VISUAL', name: 'Visual Analyst', accent: 'var(--color-series-6)',
    role: 'Builds the exploratory dashboard.', deterministic: true, nature: 'Deterministic' },
  { key: 'A9', stage: 'A9_SQL', name: 'SQL Converter', accent: 'var(--color-series-3)',
    role: 'Turns a question into SQL and a query plan.', deterministic: false, nature: 'Model' },
  { key: 'A8', stage: 'A8_META', name: 'Meta-Agent', accent: 'var(--color-series-2)',
    role: 'Reads failure telemetry and rewrites the prompts.', deterministic: false, nature: 'Model' },
]

export const ALL_AGENTS = [...AGENTS, ...SIDE_AGENTS]

const BY_STAGE = new Map(ALL_AGENTS.map((a) => [a.stage, a]))

export function agentForStage(stage) {
  if (!stage) return null
  if (BY_STAGE.has(stage)) return BY_STAGE.get(stage)
  const key = String(stage).split('_')[0]
  return ALL_AGENTS.find((a) => a.key === key) || null
}

/** Position of a stage in the forward pass, for progress. -1 if off-pipeline. */
export function stageIndex(stage) {
  return AGENTS.findIndex((a) => a.stage === stage)
}
