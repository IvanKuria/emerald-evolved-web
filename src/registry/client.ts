import type { Card, Submission } from './card'

/* The registry's API, from the browser. `null` means the registry isn't
   running (no storage configured), which the pages show as such. */

export type Listing = { total: number; first: Card | null; cards: Card[] }

export async function fetchListing(): Promise<Listing | null> {
  try {
    const r = await fetch('/api/registry')
    return r.ok ? ((await r.json()) as Listing) : null
  } catch {
    return null
  }
}

export async function fetchCard(id: string): Promise<Card | 'missing' | null> {
  try {
    const r = await fetch(`/api/registry/${encodeURIComponent(id)}`)
    if (r.status === 404) return 'missing'
    return r.ok ? ((await r.json()) as { card: Card }).card : null
  } catch {
    return null
  }
}

export async function submitCard(sub: Submission & { otId: number }): Promise<{ card: Card; first: boolean } | { error: string; id?: string }> {
  try {
    const r = await fetch('/api/registry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) })
    const j = await r.json().catch(() => ({ error: 'The registry didn’t answer.' }))
    if (r.status === 503) return { error: 'The registry isn’t open yet.' }
    return j
  } catch {
    return { error: 'The registry didn’t answer. Check your connection and try again.' }
  }
}

/* A save handed over from the Play page, kept in memory only for the
   next page to read. It is never stored and never sent. */
let handoff: Uint8Array | null = null
export const handSave = (b: Uint8Array) => void (handoff = b)
export const takeSave = () => {
  const b = handoff
  handoff = null
  return b
}
