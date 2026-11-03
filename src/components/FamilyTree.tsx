import { useEffect, useState } from 'react'
import type { Sim, Species } from '../sim/engine'
import { genePalette, loadEevee, type IndexedSprite } from '../lib/sprites'

/* ------------------------------------------------------------------
   The family tree, drawn as it grows. Time runs left to right; each
   species is a band whose thickness is how many of them are alive and
   whose colour is their average coat, taken from the same palette swap
   the sprites use. A split is where a band peels off its parent.

   Lanes are given out depth-first, so a species always sits next to the
   one it split from. Living species end in a dot and their Dex number;
   extinct ones just stop.
------------------------------------------------------------------ */

const W = 1000
/* One species is one band, so the tree is short until there is a split to draw. */
const heightFor = (n: number) => (n === 1 ? 90 : Math.min(260, 120 + n * 40))

function lanes(all: Species[], H: number) {
  const kids = new Map<number | null, Species[]>()
  for (const s of all) {
    const k = kids.get(s.parent) ?? []
    k.push(s)
    kids.set(s.parent, k)
  }
  const order: Species[] = []
  const walk = (p: number | null) => {
    for (const s of (kids.get(p) ?? []).sort((a, b) => a.born - b.born)) {
      order.push(s)
      walk(s.id)
    }
  }
  walk(null)
  const lane = new Map<number, number>()
  order.forEach((s, i) => lane.set(s.id, order.length === 1 ? H / 2 : 34 + (i * (H - 68)) / (order.length - 1)))
  return lane
}

export function swatch(sheet: IndexedSprite | null, coat: number) {
  if (!sheet) return '#8a7353'
  const [r, g, b] = genePalette(sheet.palette, coat, 0)[13]
  return `rgb(${r} ${g} ${b})`
}

export function FamilyTree({ sim, tick }: { sim: Sim; tick: number }) {
  const [sheet, setSheet] = useState<IndexedSprite | null>(null)
  useEffect(() => void loadEevee().then(setSheet), [])
  void tick
  const all = [...sim.species.values()]
  const H = heightFor(all.length)
  const lane = lanes(all, H)
  const span = Math.max(40, sim.gen)
  const X = (g: number) => 8 + (g / span) * (W - 110)
  const pop = sim.p.pop

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Family tree after ${sim.gen} generations: ${sim.livingSpecies().length} living species.`}>
      {all.map((s) => {
        const y = lane.get(s.id)!
        const h = s.history
        if (!h.length) return null
        const parentY = s.parent !== null ? lane.get(s.parent)! : y
        const first = h[0]
        const top = h.map(([g, n]) => `${X(g).toFixed(1)},${(y - (n / pop) * 26 - 1.5).toFixed(1)}`)
        const bottom = h.map(([g, n]) => `${X(g).toFixed(1)},${(y + (n / pop) * 26 + 1.5).toFixed(1)}`).reverse()
        const last = h[h.length - 1]
        const color = swatch(sheet, last[2])
        const alive = s.died === null
        return (
          <g key={s.id}>
            {s.parent !== null && (
              <path
                d={`M ${X(first[0] - 6)} ${parentY} C ${X(first[0] - 2)} ${parentY}, ${X(first[0] - 3)} ${y}, ${X(first[0])} ${y}`}
                stroke={color}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            )}
            <polygon points={[...top, ...bottom].join(' ')} fill={color} opacity={alive ? 1 : 0.45} />
            {alive && (
              <>
                <circle cx={X(last[0]) + 9} cy={y} r="4" fill={color} />
                <text x={X(last[0]) + 20} y={y + 5} fontSize="15" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-body)">
                  No.{s.dex}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
