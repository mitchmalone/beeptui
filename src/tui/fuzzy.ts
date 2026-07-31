/**
 * Pure fuzzy matching for the chat-search palette. Subsequence match (query
 * chars appear in order, case-insensitive) with a score that rewards
 * consecutive runs and word-start hits, plus the matched positions for
 * highlighting. No I/O — trivially unit-testable and fast over cached metadata.
 */

export interface FuzzyMatch {
  matched: boolean
  score: number
  /** Indices in `text` that matched, for highlight spans. */
  positions: number[]
}

const NO_MATCH: FuzzyMatch = { matched: false, score: 0, positions: [] }

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true
  const prev = text[index - 1] ?? ''
  return prev === ' ' || prev === '-' || prev === '_' || prev === '#' || prev === '/'
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch {
  if (query.length === 0) return { matched: true, score: 0, positions: [] }

  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const positions: number[] = []
  let score = 0
  let qi = 0
  let prevMatch = -2

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    positions.push(ti)
    let hit = 1
    if (ti === prevMatch + 1) hit += 3 // consecutive run
    if (isWordStart(text, ti)) hit += 2 // word-start bonus
    if (ti === 0) hit += 1 // prefix bonus
    score += hit
    prevMatch = ti
    qi++
  }

  if (qi < q.length) return NO_MATCH
  // Prefer shorter targets (a tighter match) as a mild tiebreak.
  score += Math.max(0, 10 - text.length / 4)
  return { matched: true, score, positions }
}

export interface Searchable {
  id: string
  title: string
  network: string
}

export interface ChatSearchResult {
  id: string
  title: string
  network: string
  score: number
  positions: number[]
}

/**
 * Rank chats against a query. Empty query returns everything in the given
 * order (recency, i.e. `chatOrder`). Otherwise, fuzzy-match the title (falling
 * back to "title network" so a network name also matches), rank by score, and
 * break ties by the original recency order.
 */
export function searchChats(query: string, rows: Searchable[]): ChatSearchResult[] {
  if (query.trim().length === 0) {
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      network: r.network,
      score: 0,
      positions: [],
    }))
  }

  const scored: Array<ChatSearchResult & { order: number }> = []
  rows.forEach((row, order) => {
    const onTitle = fuzzyMatch(query, row.title)
    const match = onTitle.matched ? onTitle : fuzzyMatch(query, `${row.title} ${row.network}`)
    if (!match.matched) return
    scored.push({
      id: row.id,
      title: row.title,
      network: row.network,
      score: match.score,
      positions: onTitle.matched ? onTitle.positions : [],
      order,
    })
  })

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.order - b.order))
  return scored.map((r) => ({
    id: r.id,
    title: r.title,
    network: r.network,
    score: r.score,
    positions: r.positions,
  }))
}
