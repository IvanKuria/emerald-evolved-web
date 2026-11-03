import type { Store } from './store.js'
import { buildCard, type Card, type Submission } from '../src/registry/card.js'

/* ------------------------------------------------------------------
   The Species Registry.

   Storage: each card is one JSON value under card:<id>; the sorted set
   `cards` orders them by registration time, which is also how "the
   first species ever made" is decided (lowest score). A Pokémon can be
   registered once: its trainer id + personality is claimed with SET NX.

   Abuse guards:
   - the card is rebuilt here from the genes (src/registry/card.ts), so
     only a genome the Day Care would refuse to pair with a wild one is
     accepted, and every number on the card is ours, not the client's;
   - names pass the game's character set, a length cap and a blocklist;
   - 5 registrations per hour per address, counted under a salted hash
     of the address that expires with the hour (the address itself is
     never stored);
   - a card can be hidden by deleting it from `cards` (see DESIGN.md).
------------------------------------------------------------------ */

const PER_HOUR = 5

async function hashAddr(addr: string) {
  const salt = process.env.REGISTRY_SALT ?? 'emerald-evolved'
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + addr))
  return [...new Uint8Array(d).slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const newId = () => {
  const a = crypto.getRandomValues(new Uint8Array(8))
  return [...a].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')
}

export type Result<T> = { status: number; body: T | { error: string } }

export async function submit(store: Store, body: unknown, addr: string, now = Date.now()): Promise<Result<{ card: Card; first: boolean }>> {
  if (!body || typeof body !== 'object') return { status: 400, body: { error: 'Bad request.' } }
  const sub = body as Partial<Submission> & { otId?: unknown }

  const hour = Math.floor(now / 3_600_000)
  const n = await store.incrWithin(`rl:${await hashAddr(addr)}:${hour}`, 3600)
  if (n > PER_HOUR) return { status: 429, body: { error: 'That’s a lot of new species. Try again in an hour.' } }

  const built = buildCard(sub)
  if (!built.ok) return { status: 422, body: { error: built.error } }

  const otId = Number(sub.otId)
  if (!Number.isInteger(otId) || otId < 0 || otId > 0xffffffff) return { status: 422, body: { error: 'Malformed trainer id.' } }
  const id = newId()
  const claimed = await store.set(`mon:${otId}:${sub.personality}`, id, { nx: true })
  if (!claimed) {
    const existing = await store.get(`mon:${otId}:${sub.personality}`)
    return { status: 409, body: { error: 'That Pokémon is already in the registry.', ...(existing ? { id: existing } : {}) } }
  }

  const no = (await store.zcard('cards')) + 1
  const card: Card = { id, no, createdAt: now, ...built.card }
  await store.set(`card:${id}`, JSON.stringify(card))
  await store.zadd('cards', now, id)
  return { status: 201, body: { card, first: no === 1 } }
}

async function load(store: Store, ids: string[]) {
  const raw = await store.mget(ids.map((i) => `card:${i}`))
  return raw.filter((r): r is string => !!r).map((r) => JSON.parse(r) as Card)
}

export async function list(store: Store, limit = 48): Promise<Result<{ total: number; first: Card | null; cards: Card[] }>> {
  const n = Math.max(1, Math.min(96, limit))
  const [firstId] = await store.zrange('cards', 0, 0)
  const ids = await store.zrange('cards', 0, n - 1, true)
  const [first] = firstId ? await load(store, [firstId]) : [null]
  return { status: 200, body: { total: await store.zcard('cards'), first: first ?? null, cards: await load(store, ids) } }
}

export async function one(store: Store, id: string): Promise<Result<{ card: Card }>> {
  if (!/^[a-z0-9]{6,12}$/.test(id)) return { status: 404, body: { error: 'No such card.' } }
  const [card] = await load(store, [id])
  return card ? { status: 200, body: { card } } : { status: 404, body: { error: 'No such card.' } }
}
