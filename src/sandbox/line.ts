/* ------------------------------------------------------------------
   The sandbox's breeding model: the ROM's own rules for the genes that
   matter here, in TypeScript, small enough to read in one sitting.

   From port/src/genetics.c and research/pokemon-evolution/sim/SPECIATION.md:

   - Size genes: eight pairs of loci, A1-A4 and B1-B4, two copies each
     (one from the mother, one from the father). A copy is "old" (0) or
     "new" (1). Every new copy makes the Pokémon bigger:
     size = 4 x (new copies) + (personality & 7), and the summary's
     HEIGHT is Eevee's 0.3 m x min(512, 240 + 4 x size) / 256.
   - Wild Eevee: each A copy is new 1 time in 20; B copies are always old.
   - Each copy passed to an egg is one of the parent's two at random;
     an old copy turns new 1 time in 64 (MUT_SPEC_N). Never back.
   - An egg fails to hatch 1 time in 2 for every pair where it has a new
     B next to an old A (the 2^-n hatch rule).
   - The Day Care, comparing one of the line with a wild Eevee (all old
     copies): d = the number of B loci where the line has two new copies.
     70 / 50 / 20 / 0 for d = 0 / 1 / 2 / 3+, read out in its four lines.
     The line counts as a new species when both parents are at 0.
   - Color: two hue alleles from -8 to 7, a step is 11.25 degrees; wild
     ones are off by a step 1 time in 32; a passed copy steps by one
     1 time in 24 (MUT_HUE_N). Color does nothing; it drifts.
   - Eevee is female 31 times in 256 (gender ratio 31), about 1 in 8.

   Left out: the IV, coat, shiny and inbreeding-lethal genes, which the
   game also has. Egg failures here are only the ones that make species.
------------------------------------------------------------------ */

export interface Lab {
  /** an old copy turning new, per copy passed on */
  mutation: number
  eggs: number
  female: number
  wildA: number
  hueMutation: number
}

export const LAB: Lab = { mutation: 1 / 64, eggs: 10, female: 31 / 256, wildA: 1 / 20, hueMutation: 1 / 24 }

export interface Mon {
  id: number
  /** A1..A4, B1..B4; bit 0 the mother's copy, bit 1 the father's; 1 = new */
  spec: number[]
  hue: [number, number]
  female: boolean
  pers: number
  gen: number
  /** false: "The EGG didn't hatch" */
  hatched: boolean
}

export type Rng = () => number
export function rng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let ids = 1
const bits = (v: number) => (v & 1) + ((v >> 1) & 1)

export function wild(female: boolean, r: Rng, lab = LAB): Mon {
  const hueAllele = () => {
    const x = Math.floor(r() * 32)
    return x === 0 ? -1 : x === 1 ? 1 : 0
  }
  return {
    id: ids++,
    spec: Array.from({ length: 8 }, (_, i) => (i < 4 ? (r() < lab.wildA ? 1 : 0) | (r() < lab.wildA ? 2 : 0) : 0)),
    hue: [hueAllele(), hueAllele()],
    female,
    pers: Math.floor(r() * 8),
    gen: 0,
    hatched: true,
  }
}

function pass(p: Mon, r: Rng, lab: Lab) {
  const spec = p.spec.map((v) => {
    let a = (v >> (r() < 0.5 ? 0 : 1)) & 1
    if (a === 0 && r() < lab.mutation) a = 1
    return a
  })
  let h = p.hue[r() < 0.5 ? 0 : 1]
  if (r() < lab.hueMutation) h += r() < 0.5 ? 1 : -1
  return { spec, hue: Math.max(-8, Math.min(7, h)) }
}

export function egg(mum: Mon, dad: Mon, r: Rng, lab = LAB): Mon {
  const m = pass(mum, r, lab)
  const f = pass(dad, r, lab)
  const spec = m.spec.map((a, i) => a | (f.spec[i] << 1))
  let n = 0
  for (let i = 0; i < 4; i++) if (spec[4 + i] !== 0 && spec[i] !== 3) n++
  return {
    id: ids++,
    spec,
    hue: [m.hue, f.hue],
    female: r() < lab.female,
    pers: Math.floor(r() * 8),
    gen: Math.max(mum.gen, dad.gen) + 1,
    hatched: r() < 2 ** -n,
  }
}

export const sizeOf = (m: Mon) => 4 * m.spec.reduce((a, v) => a + bits(v), 0) + m.pers
export const scaleOf = (m: Mon) => Math.min(512, 240 + 4 * sizeOf(m)) / 256
/** HEIGHT as the hack's summary shows it: GenomeHeightCm with Eevee's 3 dm. */
export const heightCm = (m: Mon) => Math.floor((3 * 10 * Math.min(512, 240 + 4 * sizeOf(m)) + 128) / 256)
export const hueOf = (m: Mon) => (m.hue[0] + m.hue[1]) * 48
/** Completed differences against a wild Eevee: B loci with both copies new. */
export const distance = (m: Mon) => m.spec.slice(4).filter((v) => v === 3).length

export type Score = 70 | 50 | 20 | 0
export const scoreOf = (d: number): Score => ([70, 50, 20, 0] as const)[Math.min(3, d)]
/** The line's verdict: a tier counts once both parents have reached it. */
export const lineScore = (mum: Mon, dad: Mon) => scoreOf(Math.min(distance(mum), distance(dad)))

/** The tallest of a sex among the hatched, ties broken at random (as the ROM's test does). */
export function tallest(litter: Mon[], female: boolean, r: Rng): Mon | null {
  let best: Mon | null = null
  let key = -1
  for (const m of litter) {
    if (!m.hatched || m.female !== female) continue
    const k = heightCm(m) * 8 + Math.floor(r() * 8)
    if (k > key) (key = k), (best = m)
  }
  return best
}

export const metres = (cm: number) => `${(cm / 100).toFixed(2)} m`
