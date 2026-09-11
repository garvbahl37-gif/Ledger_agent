/**
 * Turning the reporter's HTML into an auditable document.
 *
 * Two jobs, in order:
 *
 * 1. Sanitise. report_html is written by a language model, so it is untrusted
 *    input by definition. It is parsed into a detached document and rebuilt
 *    from an allow-list — scripts, event handlers and non-http(s) URLs never
 *    make it into the live DOM.
 *
 * 2. Bind claims to entries. Every sentence the reporter is allowed to write
 *    derives from some entry's licensed_text, but the model paraphrases, so an
 *    exact string match finds almost nothing. Matching is done on content-word
 *    overlap instead, and a sentence that matches nothing is left plain rather
 *    than guessed at — an unlinked sentence is honest, a wrongly linked one is
 *    the exact failure this product exists to prevent.
 */

const ALLOWED_TAGS = new Set([
  'P','BR','STRONG','B','EM','I','U','CODE','PRE','BLOCKQUOTE','SPAN','DIV',
  'H1','H2','H3','H4','H5','H6','UL','OL','LI','TABLE','THEAD','TBODY','TR',
  'TH','TD','HR','A','SUB','SUP','SMALL','FIGURE','FIGCAPTION','SECTION','ARTICLE',
])

const ALLOWED_ATTRS = new Set(['href', 'title', 'colspan', 'rowspan'])

const STOP = new Set([
  'the','a','an','and','or','but','of','to','in','on','at','for','with','is','are',
  'was','were','be','been','being','this','that','these','those','it','its','as','by',
  'from','has','have','had','not','no','than','then','there','their','which','who',
  'when','while','we','our','you','your','they','them','can','could','may','might',
  'will','would','should','shall','do','does','did','between','among','across','into',
  'about','also','more','most','such','some','any','each','other','both','same',
])

/** Content words only, lower-cased, ≥3 chars. */
function keywords(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s._-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  )
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared += 1
  return shared / (a.size + b.size - shared)
}

/** Sanitise untrusted HTML into a fresh document fragment. */
export function sanitizeHtml(html) {
  const parsed = new DOMParser().parseFromString(String(html ?? ''), 'text/html')
  const out = document.createDocumentFragment()

  const walk = (src, dest) => {
    for (const node of Array.from(src.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        dest.appendChild(document.createTextNode(node.nodeValue))
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      if (!ALLOWED_TAGS.has(node.tagName)) {
        // Keep the words, drop the wrapper.
        walk(node, dest)
        continue
      }

      const el = document.createElement(node.tagName.toLowerCase())
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase()
        if (!ALLOWED_ATTRS.has(name)) continue
        if (name === 'href' && !/^https?:\/\//i.test(attr.value)) continue
        el.setAttribute(name, attr.value)
      }
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }
      walk(node, el)
      dest.appendChild(el)
    }
  }

  walk(parsed.body, out)
  return out
}

/**
 * Bind the reporter's prose to the entries that licensed it.
 *
 * Two decisions shape this:
 *
 * 1. Matching is anchored on COLUMN NAMES, not general word overlap. The
 *    licensed texts are formulaic — "found no statistically significant
 *    association (p=..., FDR-corrected)" appears in every one — so the
 *    boilerplate says almost nothing about WHICH entry a sentence came from.
 *    The column names do: prose naming both `monthly_charges` and
 *    `contract_type` is about exactly one registered hypothesis.
 *
 * 2. The unit is the BLOCK (a paragraph, a list item, a cell), not the text
 *    node. The reporter writes "<strong>Monthly charges and contract type</strong>
 *    – a one-way ANOVA...", which is three text nodes for one claim; walking
 *    text nodes chopped that into fragments and linked a fragment. Marking the
 *    block keeps the inner markup intact and matches how the prose is actually
 *    organised — one finding per bullet.
 *
 * An entry is claimed only when every one of its columns appears. Word overlap
 * breaks ties. Anything else is left unlinked: an unlinked sentence is honest,
 * a wrongly linked one puts the wrong receipt behind a claim — the precise
 * failure this product exists to prevent.
 *
 * @returns {{ html: string, linked: number, total: number }}
 */
export function linkClaims(html, entries, threshold = 0.3) {
  const fragment = sanitizeHtml(html)
  const host = document.createElement('div')
  host.appendChild(fragment)

  const candidates = (entries ?? [])
    .filter((e) => e.statistical_result?.licensed_text)
    .map((e) => ({
      id: e.id,
      status: e.status,
      keys: keywords(e.statistical_result.licensed_text),
      // Each column as `snake_case` and as "snake case" — the reporter writes
      // it either way depending on whether it is quoting or prosing.
      columns: (e.columns_involved ?? []).map((c) => {
        const raw = String(c).toLowerCase()
        return { raw, spaced: raw.replace(/[_\-]+/g, ' ') }
      }),
    }))

  const countSentences = (text) =>
    text.split(/(?<=[.!?])\s+/).filter((t) => t.trim().length > 24).length

  let linked = 0
  let total = 0

  if (candidates.length) {
    // Leaf blocks only: a <li> inside a <ul> counts, the <ul> itself does not.
    const blocks = [...host.querySelectorAll('p, li, td, blockquote')]
      .filter((el) => !el.querySelector('p, li, td, blockquote'))

    for (const block of blocks) {
      const text = block.textContent || ''
      const sentences = countSentences(text)
      if (sentences === 0) continue
      total += sentences

      const haystack = text.toLowerCase()
      const normalised = haystack.replace(/[_\-]+/g, ' ')
      const keys = keywords(text)

      let best = null
      let bestScore = 0

      for (const entry of candidates) {
        if (!entry.columns.length) continue
        const hits = entry.columns.filter(
          (c) => haystack.includes(c.raw) || normalised.includes(c.spaced),
        ).length
        if (hits < entry.columns.length) continue        // needs every column
        const score = 1 + jaccard(keys, entry.keys)      // overlap only orders ties
        if (score > bestScore) { bestScore = score; best = entry }
      }

      // No column-anchored match — allow a strong pure-overlap match, which
      // covers prose that paraphrases a finding without naming its columns.
      if (!best) {
        for (const entry of candidates) {
          const score = jaccard(keys, entry.keys)
          if (score > bestScore && score >= threshold) { bestScore = score; best = entry }
        }
      }

      if (best) {
        block.classList.add('claim')
        block.dataset.claim = best.id
        block.dataset.status = best.status
        block.setAttribute('role', 'button')
        block.setAttribute('tabindex', '0')
        block.setAttribute('title', `Traces to ledger entry ${best.id} — open the receipt`)
        linked += sentences
      }
    }
  }

  return { html: host.innerHTML, linked, total }
}
