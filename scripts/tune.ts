// Runs the engine headless to see when species split, for a few seeds and settings.
import { Sim, DEFAULTS, trait, G_COAT } from '../src/sim/engine'
const configs = [
  { ...DEFAULTS },
  { ...DEFAULTS, pop: 56 },
  { ...DEFAULTS, river: false },
  { ...DEFAULTS, habitats: false },
]
for (const base of configs) {
  for (const seed of [133, 7, 42, 2026]) {
    const s = new Sim({ ...base, seed })
    const splits: number[] = []
    const t0 = performance.now()
    for (let g = 0; g < 400; g++) for (const e of s.step()) if (e.kind === 'split') splits.push(e.gen)
    const alive = s.livingSpecies().length
    const coats = s.creatures.map((c) => trait(c, G_COAT))
    console.log(JSON.stringify({ pop: base.pop, river: base.river, hab: base.habitats, seed, splits: splits.slice(0, 6), alive, n: s.creatures.length,
      coatMin: Math.min(...coats).toFixed(2), coatMax: Math.max(...coats).toFixed(2), ms: Math.round(performance.now() - t0), ev: s.events.slice(0, 4).map(e => e.kind + e.gen) }))
  }
}
