/**
 * A small tokenizer for Python and SQL.
 *
 * A real highlighter library would be ~40KB gzipped to render short pandas
 * snippets and one-line SELECTs, which is the entire need here. This handles
 * strings, comments, numbers, keywords and calls — the categories that matter
 * for reading a receipt — and returns tokens rather than HTML so React can
 * render them without dangerouslySetInnerHTML.
 */

const PY_KEYWORDS = new Set([
  'and','as','assert','async','await','break','class','continue','def','del','elif','else',
  'except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not',
  'or','pass','raise','return','try','while','with','yield','True','False','None','self',
])

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','JOIN','LEFT','RIGHT',
  'INNER','OUTER','FULL','ON','AS','AND','OR','NOT','IN','IS','NULL','DISTINCT','COUNT','SUM',
  'AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','UNION','ALL','WITH','DESC','ASC','LIKE',
  'BETWEEN','EXISTS','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','CAST',
  'ROUND','OVER','PARTITION','ROW_NUMBER','RANK','COALESCE',
])

const PATTERNS = [
  ['comment', /^(#[^\n]*|--[^\n]*)/],
  ['string',  /^("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/],
  ['number',  /^(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)/],
  ['ident',   /^([A-Za-z_][A-Za-z0-9_]*)/],
  ['space',   /^(\s+)/],
  ['punct',   /^([(){}[\],.:;=+\-*/%<>!&|^~@]+)/],
]

/** @returns {{type: string, value: string}[]} */
export function tokenize(code, lang = 'python') {
  if (!code) return []
  const keywords = lang === 'sql' ? SQL_KEYWORDS : PY_KEYWORDS
  const tokens = []
  let rest = String(code)
  let guard = 0

  while (rest.length && guard++ < 200000) {
    let matched = false

    for (const [type, re] of PATTERNS) {
      const m = re.exec(rest)
      if (!m) continue
      const value = m[1]

      if (type === 'ident') {
        const probe = lang === 'sql' ? value.toUpperCase() : value
        if (keywords.has(probe)) {
          tokens.push({ type: 'keyword', value })
        } else if (rest[value.length] === '(') {
          tokens.push({ type: 'call', value })
        } else {
          tokens.push({ type: 'plain', value })
        }
      } else {
        tokens.push({ type, value })
      }

      rest = rest.slice(value.length)
      matched = true
      break
    }

    if (!matched) {
      tokens.push({ type: 'plain', value: rest[0] })
      rest = rest.slice(1)
    }
  }
  return tokens
}

export const TOKEN_CLASS = {
  comment: 'text-slate/70 italic',
  string:  'text-supported-text',
  number:  'text-a2',
  keyword: 'text-a3 font-medium',
  call:    'text-series-6',
  punct:   'text-graphite',
  plain:   'text-ink',
  space:   '',
}
