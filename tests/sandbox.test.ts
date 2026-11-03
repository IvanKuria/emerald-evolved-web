import { describe, expect, it } from 'vitest'
import { egg, heightCm, lineScore, rng, tallest, wild, type Mon } from '../src/sandbox/line'

/* The sandbox's model against the ROM's own measurement (BUILD_STATUS.md, "Eevee numbers"): keeping
   the tallest son and daughter of 10 eggs a generation, with Eevee's 1-in-8 daughters, the median line
   becomes a new species at generation 31 (p10 21, p90 45). */
function line(seed: number) {
  const r = rng(seed)
  let mum = wild(true, r)
  let dad = wild(false, r)
  for (let g = 1; g <= 200; g++) {
    const litter = Array.from({ length: 10 }, () => egg(mum, dad, r))
    mum = tallest(litter, true, r) ?? mum
    dad = tallest(litter, false, r) ?? dad
    if (lineScore(mum, dad) === 0) return g
  }
  return 999
}

describe('sandbox breeding model', () => {
  it('wild Eevee are about 0.3 m (0.28-0.33 in the ROM, rarely more) and a wild pair gets along very well', () => {
    const r = rng(7)
    const hs = Array.from({ length: 200 }, () => heightCm(wild(true, r)))
    expect(Math.min(...hs)).toBeGreaterThanOrEqual(28)
    expect(Math.max(...hs)).toBeLessThanOrEqual(36) // a wild one carrying two new A copies
    const a: Mon = wild(true, r)
    expect(lineScore(a, wild(false, r))).toBe(70)
  })

  it('selecting the tallest makes a new species in about as many generations as the ROM', () => {
    const gens = Array.from({ length: 200 }, (_, i) => line(1000 + i)).sort((a, b) => a - b)
    const median = gens[100]
    expect(median).toBeGreaterThanOrEqual(22)
    expect(median).toBeLessThanOrEqual(40)
    expect(gens[180]).toBeLessThan(200)
  })
})

describe('sandbox sexes', () => {
  it('about one Eevee egg in eight is a daughter (gender ratio 31/256)', () => {
    const r = rng(5)
    const m = wild(true, r)
    const d = wild(false, r)
    let f = 0
    for (let i = 0; i < 20000; i++) if (egg(m, d, r).female) f++
    expect(f / 20000).toBeGreaterThan(0.105)
    expect(f / 20000).toBeLessThan(0.137)
  })
})
