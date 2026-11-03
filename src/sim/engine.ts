/* ------------------------------------------------------------------
   The evolution engine. One file, no dependencies, deterministic for a
   given seed and settings -- which is what makes a sandbox run
   shareable as a link instead of as a video.

   These are the rules the ROM hack implements in C; the site runs the
   same rules in the browser so you can watch a thousand generations in
   a minute instead of breeding them by hand.

   GENOME
   Every creature is diploid: two copies (alleles) of each gene, one from
   each parent, picked 50/50. That is Mendel, and it is the rule the
   owner's Real Genetics patch already ships. Six genes:

     0 coat      the body colour        (selected by habitat)
     1 mane      the cream ruff colour  (neutral: it only drifts)
     2 size      body size              (selected by habitat)
     3-5 hidden  three invisible genes  (neutral: the "molecular clock")

   A trait is the mean of its two alleles.

   MUTATION
   Each allele copied into an egg mutates with probability `mu`, by a
   small normal step. Most mutations are tiny. A few are visible.

   SELECTION
   The map has two habitats, left and right, with different best coats
   and sizes. A creature's fitness is how close it is to its habitat's
   optimum; fitter creatures are picked as parents more often. That is
   the whole of natural selection. In the game, you are the habitat:
   you choose who goes to the Day Care.

   SPECIATION
   Two creatures can only breed if they are similar enough: the
   distance between their hidden genes and their coats must be under a
   threshold. In the game this replaces the egg-group check, and it is
   where the Day Care says "The two prefer to play with other POKéMON
   than each other." When a population drifts so far that no pair
   across a gap can breed, it has become two species. No one draws the
   line; it falls out of the rule.
------------------------------------------------------------------ */

export const GENES = 6
export const G_COAT = 0
export const G_MANE = 1
export const G_SIZE = 2

export interface SimParams {
  seed: number
  /** Carrying capacity: how many creatures each generation holds. */
  pop: number
  /** 0..1 */
  mutation: number
  /** 0..1 */
  selection: number
  /** A river down the middle that blocks most movement. */
  river: boolean
  /** Left and right habitats favour different creatures. */
  habitats: boolean
}

export const DEFAULTS: SimParams = {
  seed: 133,
  pop: 120,
  mutation: 0.45,
  selection: 0.6,
  river: true,
  habitats: true,
}

export interface Creature {
  id: number
  x: number
  y: number
  /** 2 * GENES alleles, interleaved [g0a, g0b, g1a, g1b, ...] */
  dna: Float32Array
  species: number
  /** index of the mother in the previous generation, -1 for the founders */
  mother: number
  /** a visible mutation happened in this egg */
  mutant: boolean
}

export interface Species {
  id: number
  /** National Dex number. Emerald's dex stops at 386, so new ones carry on from there. */
  dex: number
  parent: number | null
  born: number
  died: number | null
  /** per-generation [gen, count, meanCoat, meanSize] */
  history: [number, number, number, number][]
}

export type SimEvent =
  | { kind: 'mutation'; gen: number; coat: number }
  | { kind: 'refused'; gen: number }
  | { kind: 'split'; gen: number; species: number; parent: number }
  | { kind: 'extinct'; gen: number; species: number }

/* ---- randomness ------------------------------------------------------ */

export function rng(seed: number) {
  let a = seed >>> 0 || 1
  const next = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  const gauss = () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let u = 0
    while (u === 0) u = next()
    const v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
  return { next, gauss }
}

/* ---- traits ---------------------------------------------------------- */

export const trait = (c: Creature, g: number) => (c.dna[g * 2] + c.dna[g * 2 + 1]) / 2

/* The two habitats' ideals. Coat values are turns of hue away from
   Eevee's own brown: +0.5 leans leaf green, -0.55 leans dusk violet.
   The names are flavour; the numbers are what select. */
const LEFT = { coat: 0.5, size: -0.45 }
const RIGHT = { coat: -0.55, size: 0.5 }

function optimum(x: number, p: SimParams) {
  if (!p.habitats) return { coat: 0, size: 0 }
  const t = Math.min(1, Math.max(0, (x - 0.3) / 0.4))
  const s = t * t * (3 - 2 * t)
  return { coat: LEFT.coat + (RIGHT.coat - LEFT.coat) * s, size: LEFT.size + (RIGHT.size - LEFT.size) * s }
}

export function fitness(c: Creature, p: SimParams) {
  const o = optimum(c.x, p)
  const dc = trait(c, G_COAT) - o.coat
  const ds = trait(c, G_SIZE) - o.size
  return Math.exp(-p.selection * 7 * (dc * dc + 0.6 * ds * ds))
}

/* Who can breed with whom. Hidden genes plus coat, because in real
   animals colour is often how they recognise their own kind (Lake
   Victoria cichlids speciated along exactly this line). */
export const COMPAT_LIMIT = 0.55
export function distance(a: Creature, b: Creature) {
  let d = 0
  for (let g = 3; g < GENES; g++) {
    const k = trait(a, g) - trait(b, g)
    d += k * k
  }
  const c = trait(a, G_COAT) - trait(b, G_COAT)
  return Math.sqrt(d + 0.5 * c * c)
}
export const compatible = (a: Creature, b: Creature) => distance(a, b) < COMPAT_LIMIT

/* ---- the simulation -------------------------------------------------- */

const STEP = [0.13, 0.12, 0.1, 0.1, 0.1, 0.1]
const MATE_RADIUS = 0.16
const DISPERSAL = 0.06

export class Sim {
  p: SimParams
  gen = 0
  creatures: Creature[] = []
  species = new Map<number, Species>()
  events: SimEvent[] = []
  private r: ReturnType<typeof rng>
  private nextId = 1
  private nextSpecies = 1
  private refusedOnce = false
  private pending = new Map<number, number>()
  private lastMutationEvent = -99

  constructor(p: SimParams) {
    this.p = { ...p }
    this.r = rng(p.seed)
    const sp: Species = { id: 0, dex: 133, parent: null, born: 0, died: null, history: [] }
    this.species.set(0, sp)
    for (let i = 0; i < p.pop; i++) {
      const dna = new Float32Array(GENES * 2)
      for (let k = 0; k < dna.length; k++) dna[k] = this.r.gauss() * 0.04
      this.creatures.push({
        id: this.nextId++,
        x: 0.08 + this.r.next() * 0.84,
        y: 0.1 + this.r.next() * 0.8,
        dna,
        species: 0,
        mother: -1,
        mutant: false,
      })
    }
    this.record()
  }

  /** One generation. Returns the events it produced. */
  step(): SimEvent[] {
    const { r, p } = this
    const prev = this.creatures
    const n = prev.length
    const out: SimEvent[] = []
    if (n < 2) return out

    const w = prev.map((c) => fitness(c, p))

    // spatial buckets for "who is nearby"
    const G = 8
    const grid: number[][] = Array.from({ length: G * G }, () => [])
    const cell = (x: number) => Math.min(G - 1, Math.max(0, Math.floor(x * G)))
    prev.forEach((c, i) => grid[cell(c.y) * G + cell(c.x)].push(i))
    const near = (c: Creature) => {
      const res: number[] = []
      const cx = cell(c.x)
      const cy = cell(c.y)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const X = cx + dx
          const Y = cy + dy
          if (X < 0 || Y < 0 || X >= G || Y >= G) continue
          for (const j of grid[Y * G + X]) {
            const o = prev[j]
            if (o === c) continue
            if (p.river && (o.x < 0.5) !== (c.x < 0.5)) continue
            if (Math.hypot(o.x - c.x, o.y - c.y) < MATE_RADIUS) res.push(j)
          }
        }
      return res
    }

    /* Soft selection. Each egg is laid somewhere first -- a random
       creature's spot -- and only then do the fit win, among the locals.
       Without this one habitat's champions take over the whole map, which
       is not how a valley works. With two habitats, each half holds half. */
    const halves = p.river || p.habitats
    const sides: number[][] = [[], []]
    prev.forEach((c, i) => sides[c.x < 0.5 ? 0 : 1].push(i))
    /* The egg's spot is a random point on the ground, and the nearest
       creature is the one whose neighbourhood breeds there. Empty ground
       gets filled by whoever is closest, so the population spreads over
       the map instead of collapsing into one clump (picking a random
       creature instead lets crowds breed crowds). */
    const site = (k: number) => {
      const both = halves && sides[0].length && sides[1].length
      const side = both ? k % 2 : -1
      const pool = side === -1 ? sides[0].concat(sides[1]) : sides[side]
      const px = side === -1 ? r.next() : side === 0 ? r.next() * 0.5 : 0.5 + r.next() * 0.5
      const py = r.next()
      let best = pool[0]
      let bd = Infinity
      for (const j of pool) {
        const d = (prev[j].x - px) ** 2 + (prev[j].y - py) ** 2
        if (d < bd) { bd = d; best = j }
      }
      return best
    }
    const localPick = (center: number) => {
      const pool = [center, ...near(prev[center])]
      let sum = 0
      for (const j of pool) sum += w[j]
      let t = r.next() * sum
      for (const j of pool) if ((t -= w[j]) <= 0) return j
      return pool[pool.length - 1]
    }

    const mu = 0.015 + 0.25 * p.mutation
    const kids: Creature[] = []
    let refused = 0
    let attempts = 0
    let tries = 0
    while (kids.length < p.pop && tries < p.pop * 6) {
      tries++
      const mi = localPick(site(kids.length))
      const mother = prev[mi]
      const options = near(mother)
      if (!options.length) continue
      let father: Creature | null = null
      for (let k = 0; k < 6 && !father; k++) {
        const cj = options[Math.floor(r.next() * options.length)]
        const cand = prev[cj]
        if (r.next() > w[cj] / (w[mi] + 1e-9) + 0.25) continue
        attempts++
        if (compatible(mother, cand)) father = cand
        else refused++
      }
      if (!father) continue

      const dna = new Float32Array(GENES * 2)
      let mutant = false
      for (let g = 0; g < GENES; g++) {
        dna[g * 2] = mother.dna[g * 2 + (r.next() < 0.5 ? 0 : 1)]
        dna[g * 2 + 1] = father.dna[g * 2 + (r.next() < 0.5 ? 0 : 1)]
        for (let a = 0; a < 2; a++)
          if (r.next() < mu) {
            const jump = r.gauss() * STEP[g] * (r.next() < 0.06 ? 3.2 : 1)
            dna[g * 2 + a] += jump
            if (g === G_COAT && Math.abs(jump) > 0.22) mutant = true
          }
        dna[g * 2] = Math.max(-1, Math.min(1, dna[g * 2]))
        dna[g * 2 + 1] = Math.max(-1, Math.min(1, dna[g * 2 + 1]))
      }
      let x = mother.x + r.gauss() * DISPERSAL
      let y = mother.y + r.gauss() * DISPERSAL
      if (p.river && (x < 0.5) !== (mother.x < 0.5) && r.next() < 0.985) x = mother.x - (x - mother.x)
      x = Math.min(0.97, Math.max(0.03, x))
      y = Math.min(0.95, Math.max(0.05, y))
      kids.push({ id: this.nextId++, x, y, dna, species: mother.species, mother: mi, mutant })
    }

    this.gen++
    this.creatures = kids
    if (refused > attempts * 0.12 && !this.refusedOnce) {
      this.refusedOnce = true
      out.push({ kind: 'refused', gen: this.gen })
    }
    const m = kids.find((k) => k.mutant)
    if (m && this.gen - this.lastMutationEvent > 24) {
      this.lastMutationEvent = this.gen
      out.push({ kind: 'mutation', gen: this.gen, coat: trait(m, G_COAT) })
    }
    out.push(...this.classify())
    this.record()
    this.events.push(...out)
    return out
  }

  /* Species are found, not declared: creatures that could breed with
     each other (directly or through a chain of others) are one species.
     Union-find over every compatible pair. Specks of fewer than four
     are hybrids or stragglers and are folded into their nearest group. */
  private classify(): SimEvent[] {
    const cs = this.creatures
    const n = cs.length
    const parent = Int32Array.from({ length: n }, (_, i) => i)
    const find = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]]
      return i
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (compatible(cs[i], cs[j])) parent[find(i)] = find(j)

    const groups = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const root = find(i)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(i)
    }
    const minSize = Math.max(5, Math.round(n * 0.06))
    const big = [...groups.values()].filter((g) => g.length >= minSize).sort((x, y) => y.length - x.length)

    /* A species only ever gains a new label by splitting. Groups never
       get merged back: a few river-crossers making the occasional hybrid
       is not two species fusing. And a split has to hold for three
       generations running before it is called, so one unlucky
       generation cannot invent a species. */
    const byLabel = new Map<number, number[][]>()
    for (const g of big) {
      const votes = new Map<number, number>()
      for (const i of g) votes.set(cs[i].species, (votes.get(cs[i].species) ?? 0) + 1)
      const label = [...votes.entries()].sort((x, y) => y[1] - x[1])[0][0]
      if (!byLabel.has(label)) byLabel.set(label, [])
      byLabel.get(label)!.push(g)
    }

    const ev: SimEvent[] = []
    for (const [label, gs] of byLabel) {
      if (gs.length < 2) {
        this.pending.delete(label)
        continue
      }
      const held = (this.pending.get(label) ?? 0) + 1
      this.pending.set(label, held)
      if (held < 3) continue
      this.pending.delete(label)
      for (const g of gs.slice(1)) {
        const id = this.nextSpecies++
        this.species.set(id, { id, dex: 386 + id, parent: label, born: this.gen, died: null, history: [] })
        for (const i of g) if (cs[i].species === label) cs[i].species = id
        ev.push({ kind: 'split', gen: this.gen, species: id, parent: label })
      }
    }

    const counts = new Map<number, number>()
    for (const c of cs) counts.set(c.species, (counts.get(c.species) ?? 0) + 1)
    for (const sp of this.species.values())
      if (sp.died === null && !counts.has(sp.id)) {
        sp.died = this.gen
        ev.push({ kind: 'extinct', gen: this.gen, species: sp.id })
      }
    return ev
  }

  private record() {
    const acc = new Map<number, [number, number, number]>()
    for (const c of this.creatures) {
      const a = acc.get(c.species) ?? [0, 0, 0]
      a[0]++
      a[1] += trait(c, G_COAT)
      a[2] += trait(c, G_SIZE)
      acc.set(c.species, a)
    }
    for (const [id, [k, coat, size]] of acc) this.species.get(id)?.history.push([this.gen, k, coat / k, size / k])
  }

  livingSpecies() {
    return [...this.species.values()].filter((s) => s.died === null)
  }

  /** Mean genetic distance between a creature on the left half and one on
      the right, over every such pair. NaN if a half is empty. This is what
      the Day Care readout shows: how well one from each side would get on. */
  crossDistance() {
    const L: Creature[] = []
    const R: Creature[] = []
    for (const c of this.creatures) (c.x < 0.5 ? L : R).push(c)
    if (!L.length || !R.length) return NaN
    let d = 0
    for (const a of L) for (const b of R) d += distance(a, b)
    return d / (L.length * R.length)
  }
}

/* ---- share links ----------------------------------------------------- */

export function encodeParams(p: SimParams, gen?: number) {
  const q = new URLSearchParams({
    seed: String(p.seed),
    pop: String(p.pop),
    mu: p.mutation.toFixed(2),
    sel: p.selection.toFixed(2),
    river: p.river ? '1' : '0',
    hab: p.habitats ? '1' : '0',
  })
  if (gen) q.set('gen', String(gen))
  return q.toString()
}

export function decodeParams(search: string): { params: SimParams; gen: number } {
  const q = new URLSearchParams(search)
  const num = (k: string, d: number, lo: number, hi: number) => {
    const v = Number(q.get(k))
    return q.has(k) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d
  }
  return {
    params: {
      seed: Math.round(num('seed', DEFAULTS.seed, 1, 2 ** 31)),
      pop: Math.round(num('pop', DEFAULTS.pop, 30, 240)),
      mutation: num('mu', DEFAULTS.mutation, 0, 1),
      selection: num('sel', DEFAULTS.selection, 0, 1),
      river: q.has('river') ? q.get('river') === '1' : DEFAULTS.river,
      habitats: q.has('hab') ? q.get('hab') === '1' : DEFAULTS.habitats,
    },
    gen: Math.round(num('gen', 0, 0, 5000)),
  }
}
