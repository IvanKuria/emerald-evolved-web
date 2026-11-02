import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { applyBps, createBps, crc32, readBpsHeader, BpsError } from '../src/lib/bps'
import { sha1Js } from '../src/lib/sha1'
import { judge, readHeader, TEST_CART, EMERALD } from '../src/lib/rom'

const fx = (f: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)))
const sha1 = (b: Uint8Array) => createHash('sha1').update(b).digest('hex')

function rand(seed: number) {
  let a = seed
  return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('sha1 fallback', () => {
  it('matches node for several lengths, including block edges', () => {
    const r = rand(1)
    for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 100_003]) {
      const b = Uint8Array.from({ length: n }, () => (r() * 256) | 0)
      const ours = Array.from(sha1Js(b), (x) => x.toString(16).padStart(2, '0')).join('')
      expect(ours).toBe(sha1(b))
    }
  })
})

describe('BPS', () => {
  it('applies a patch made by Flips (independent encoder)', () => {
    const out = applyBps(fx('evotest.gba'), fx('evotest-by-flips.bps'))
    expect(sha1(out)).toBe(TEST_CART.targetSha1)
  })

  it('applies the shipped test patch made by our encoder', () => {
    const patch = new Uint8Array(readFileSync(new URL('../public/test/evotest-mutant.bps', import.meta.url)))
    expect(sha1(applyBps(fx('evotest.gba'), patch))).toBe(TEST_CART.targetSha1)
    expect(readBpsHeader(patch).metadata).toContain('EVOTEST')
  })

  it('round-trips random edits, inserts and deletions on a 1 MB file', () => {
    const r = rand(7)
    const src = Uint8Array.from({ length: 1 << 20 }, () => (r() * 256) | 0)
    const parts: Uint8Array[] = []
    let i = 0
    while (i < src.length) {
      const run = (r() * 40000) | 0
      parts.push(src.subarray(i, i + run))
      i += run
      const op = r()
      if (op < 0.3) parts.push(Uint8Array.from({ length: (r() * 300) | 0 }, () => (r() * 256) | 0)) // insert
      else if (op < 0.5) i += (r() * 500) | 0 // delete
      else if (op < 0.7) parts.push(new Uint8Array(200).fill(0xff)) // a run (TargetCopy-friendly)
    }
    const dst = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
    let o = 0
    for (const p of parts) (dst.set(p, o), (o += p.length))
    const patch = createBps(src, dst)
    expect(patch.length).toBeLessThan(dst.length / 4)
    expect(applyBps(src, patch)).toEqual(dst)
  })

  it('handles TargetCopy runs that overlap their own output', () => {
    // hand-written: TargetRead "AB", then TargetCopy 6 bytes from offset 0 -> ABABABAB
    const body = [0x42, 0x50, 0x53, 0x31, 0x80, 0x88, 0x80, ((2 - 1) << 2) | 1 | 0x80, 0x41, 0x42, ((6 - 1) << 2) | 3 | 0x80, 0x80]
    const src = new Uint8Array(0)
    const target = new TextEncoder().encode('ABABABAB')
    const p = new Uint8Array(body.length + 12)
    p.set(body)
    const dv = new DataView(p.buffer)
    dv.setUint32(body.length, crc32(src), true)
    dv.setUint32(body.length + 4, crc32(target), true)
    dv.setUint32(body.length + 8, crc32(p, 0, body.length + 8), true)
    expect(new TextDecoder().decode(applyBps(src, p))).toBe('ABABABAB')
  })

  it('refuses the wrong source and says it is the source', () => {
    const wrong = fx('evotest-mutant.gba')
    try {
      applyBps(wrong, fx('evotest-by-flips.bps'))
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BpsError)
      expect((e as BpsError).culprit).toBe('source')
    }
  })

  it('refuses a damaged patch', () => {
    const p = fx('evotest-by-flips.bps')
    p[10] ^= 0xff
    expect(() => applyBps(fx('evotest.gba'), p)).toThrow(/damaged/)
  })
})

describe('ROM identification', () => {
  it('knows the test cartridge by hash', () => {
    const rom = fx('evotest.gba')
    expect(sha1(rom)).toBe(TEST_CART.sourceSha1)
    expect(judge(rom, sha1(rom), TEST_CART).ok).toBe(true)
    expect(readHeader(rom)?.title).toBe('EVOTEST')
  })
  it('names an Emerald that has been modified', () => {
    const rom = fx('evotest.gba').slice()
    rom.set(new TextEncoder().encode('BPEE'), 0xac)
    const v = judge(rom, sha1(rom), EMERALD)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.title).toMatch(/not an untouched copy/)
  })
  it('the Emerald hash is the pret pokeemerald one', () => {
    expect(EMERALD.sourceSha1).toBe('f3ae088181bf583e55daf962a92bb46f4f1d07b7')
  })
})
