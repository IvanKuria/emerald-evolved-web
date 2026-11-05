import { describe, expect, it } from 'vitest'
import { memoryStore } from '../server/store'
import { submit, list, one } from '../server/registry'
import { pack } from '../src/save/genome'
import { toHex } from '../src/registry/card'
import { NEW_SPECIES, ALMOST } from './fixtures/build-save'

const sub = (personality: number, extra = {}) => ({
  species: 133, genome: toHex(pack(NEW_SPECIES)), personality, otId: 4242, generation: null, trainer: 'MAY', name: 'Mossling', ...extra,
})

describe('registry server', () => {
  it('stores a recomputed card and marks the first', async () => {
    const s = memoryStore(true)
    const r = await submit(s, { ...sub(1), size: 999, d: 9 }, '1.2.3.4')
    expect(r.status).toBe(201)
    const body = r.body as { card: { size: number; d: number; no: number }; first: boolean }
    expect(body.first).toBe(true)
    expect(body.card.size).toBe(4 * 13 + 1) // ours, not the 999 the client sent
    expect(body.card.d).toBe(3)
    const l = await list(s)
    expect((l.body as { total: number }).total).toBe(1)
    const id = (r.body as { card: { id: string } }).card.id
    expect((await one(s, id)).status).toBe(200)
  })
  it('refuses duplicates, non-species and bad names', async () => {
    const s = memoryStore(true)
    expect((await submit(s, sub(1), 'a')).status).toBe(201)
    expect((await submit(s, sub(1), 'a')).status).toBe(409)
    expect((await submit(s, sub(2, { genome: toHex(pack(ALMOST)) }), 'a')).status).toBe(422)
    expect((await submit(s, sub(3, { name: 'fvckface' }), 'a')).status).toBe(422)
  })
  it('rate limits per address', async () => {
    const s = memoryStore(true)
    const codes = []
    for (let i = 0; i < 7; i++) codes.push((await submit(s, sub(10 + i), '9.9.9.9')).status)
    expect(codes).toEqual([201, 201, 201, 201, 201, 429, 429])
    expect((await submit(s, sub(20), '8.8.8.8')).status).toBe(201)
  })
})
