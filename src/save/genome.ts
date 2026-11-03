import { G, HUE_STEP } from './layout.js'

/* ------------------------------------------------------------------
   The genome, unpacked from its 77 bits, and the few things the site
   needs to know about it. Mirrors port/src/genetics.c (UnpackGenome,
   GenomeCoat, GenomeHueShift, GenomeIsShiny) and the speciation rule
   in sim/speciation_sim.py. Shared by the browser and the server, so
   the server recomputes every claim on a card from the genes alone.
------------------------------------------------------------------ */

export interface Genome {
  shiny: number
  coat: [number, number, number]
  hue: [number, number]
  /** loci A1-A4 then B1-B4, two allele bits each (bit 0 mother, bit 1 father), 1 = derived */
  spec: number[]
  has: boolean
}

export const COAT = { normal: 0, albino: 1, red: 2, black: 3 } as const

/** The 77 bits as three little-endian 32-bit words, the ROM's own packed form. */
export type Packed = [number, number, number]

export const bits = (p: Packed, pos: number, n: number) => {
  let v = 0
  for (let i = 0; i < n; i++, pos++) v |= ((p[pos >> 5] >>> (pos & 31)) & 1) << i
  return v >>> 0
}
export const putBits = (p: Packed, pos: number, n: number, v: number) => {
  for (let i = 0; i < n; i++, pos++) if ((v >>> i) & 1) p[pos >> 5] = (p[pos >> 5] | (1 << (pos & 31))) >>> 0
}

const sign4 = (v: number) => (v & 8 ? v - 16 : v)

export function unpack(p: Packed): Genome {
  return {
    shiny: bits(p, G.shiny, 2),
    coat: [bits(p, G.coat, 2), bits(p, G.coat + 2, 2), bits(p, G.coat + 4, 2)],
    hue: [sign4(bits(p, G.hue, 4)), sign4(bits(p, G.hue + 4, 4))],
    spec: Array.from({ length: 8 }, (_, i) => bits(p, G.spec + i * 2, 2)),
    has: bits(p, G.has, 1) === 1,
  }
}

/** Only for tests and fixtures: the inverse of unpack (IV/lethal bits left zero). */
export function pack(g: Genome): Packed {
  const p: Packed = [0, 0, 0]
  putBits(p, G.shiny, 2, g.shiny)
  g.coat.forEach((c, i) => putBits(p, G.coat + i * 2, 2, c))
  putBits(p, G.hue, 4, g.hue[0] & 15)
  putBits(p, G.hue + 4, 4, g.hue[1] & 15)
  g.spec.forEach((s, i) => putBits(p, G.spec + i * 2, 2, s))
  putBits(p, G.has, 1, g.has ? 1 : 0)
  return p
}

export const isShiny = (g: Genome) => g.shiny !== 0

export function coatOf(g: Genome): number {
  if (g.coat[0] === 3) return COAT.albino
  if (g.coat[1] === 3) return COAT.red
  if (g.coat[2] === 3) return COAT.black
  return COAT.normal
}

/** Hue shift in the ROM's units (1536 = a full turn). */
export const hueShift = (g: Genome) => (g.hue[0] + g.hue[1]) * HUE_STEP

const popcount = (v: number) => {
  let n = 0
  for (; v; v &= v - 1) n++
  return n
}

/** sim/SPECIATION.md: size = 4 * popcount(16 speciation bits) + (personality & 7), 0..71. */
export const sizeOf = (g: Genome, personality: number) => 4 * g.spec.reduce((a, s) => a + popcount(s), 0) + (personality & 7)

/** The ROM's battle and follower scale for a size: min(512, 240 + 4 x size) / 256, so 0.94x to 2.0x. */
export const displayScale = (size: number) => Math.min(512, 240 + 4 * size) / 256

/* The Day Care's verdict against the wild type (all loci ancestral).
   d counts pairs where this Pokémon is homozygous derived at B_i; the
   wild type is 00 at every A_i, so each such B_i is a completed
   incompatibility. Score = [70, 50, 20, 0][min(d, 3)]. */
export const SCORE_BY_D = [70, 50, 20, 0] as const
export function scoreVsWild(g: Genome): { d: number; score: 70 | 50 | 20 | 0 } {
  const d = g.spec.slice(4).filter((b) => b === 3).length
  return { d, score: SCORE_BY_D[Math.min(d, 3)] }
}

/** A line that has split off: the Day Care would never pair it with a wild one. */
export const isNewSpecies = (g: Genome) => g.has && scoreVsWild(g).score === 0
