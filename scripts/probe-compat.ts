// Headless: how cross-river compatibility falls before a split, to set the readout's tiers.
import { Sim, DEFAULTS, distance, compatible } from '../src/sim/engine'
const runs = [
  { name: 'hero', p: { seed: 42, pop: 56, mutation: 0.45, selection: 0.6, river: true, habitats: true } },
  { name: 'sandbox', p: { ...DEFAULTS } },
  { name: 'sb7', p: { ...DEFAULTS, seed: 7 } },
]
for (const r of runs) {
  const s = new Sim(r.p)
  const rows: string[] = []
  let split = -1
  for (let g = 0; g < 400 && split < 0; g++) {
    for (const e of s.step()) if (e.kind === 'split' && split < 0) split = s.gen
    const L = s.creatures.filter((c) => c.x < 0.5), R = s.creatures.filter((c) => c.x >= 0.5)
    let ok = 0, n = 0, d = 0
    for (const a of L) for (const b of R) { n++; d += distance(a, b); if (compatible(a, b)) ok++ }
    if (s.gen % 4 === 0 || split > 0) rows.push(`${s.gen}:${(ok / n).toFixed(3)}/${(d / n).toFixed(2)}`)
  }
  console.log(r.name, 'split', split, rows.join(' '))
}
