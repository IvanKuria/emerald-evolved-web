import { useRef, useState } from 'react'
import { Creature } from './Creature'
import { rng } from '../sim/engine'

/* ------------------------------------------------------------------
   Pick a parent. Five babies per generation, each a small mutation away
   from the one you picked last time. Pick on any rule you like -- the
   greenest, the darkest -- and watch the line follow you. Four rows are
   kept on screen so the drift is visible without scrolling; older rows
   slide away.
------------------------------------------------------------------ */

interface Row {
  gen: number
  kids: { coat: number; mane: number }[]
  picked: number | null
}

const KIDS = 5

export function SelectionDemo() {
  const r = useRef(rng(7))
  const litter = (coat: number, mane: number) =>
    Array.from({ length: KIDS }, () => ({ coat: coat + r.current.gauss() * 0.09, mane: mane + r.current.gauss() * 0.08 }))
  const [rows, setRows] = useState<Row[]>(() => [{ gen: 1, kids: litter(0, 0), picked: null }])

  const pick = (ri: number, ki: number) => {
    const row = rows[ri]
    if (row.picked !== null) return
    const k = row.kids[ki]
    const next = rows.map((x, i) => (i === ri ? { ...x, picked: ki } : x))
    setRows([...next, { gen: row.gen + 1, kids: litter(k.coat, k.mane), picked: null }].slice(-4))
  }

  const reset = () => {
    r.current = rng(Math.floor(Math.random() * 1e9))
    setRows([{ gen: 1, kids: litter(0, 0), picked: null }])
  }

  return (
    <div className="rounded-card bg-paper-lift p-6 shadow-card sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-body font-semibold text-ink">Pick the one you’d breed</p>
        <button className="text-meta font-semibold text-ash hover:text-ink" onClick={reset}>
          Start over
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {rows.map((row, ri) => (
          <div key={row.gen} className="flex items-center gap-3" style={{ animation: 'rise 420ms var(--ease-out) both' }}>
            <span className="w-11 shrink-0 text-meta font-semibold text-ash tc">Gen {row.gen}</span>
            <div className="flex min-w-0 flex-1 justify-between gap-1">
              {row.kids.map((k, ki) => {
                const isPicked = row.picked === ki
                const faded = row.picked !== null && !isPicked
                return (
                  <button
                    key={ki}
                    onClick={() => pick(ri, ki)}
                    disabled={row.picked !== null}
                    aria-label={`Breed baby ${ki + 1} of generation ${row.gen}`}
                    className="flex max-w-20 min-w-0 flex-1 justify-center rounded-field px-0.5 pt-1.5 pb-1 transition-[opacity,transform,background-color] duration-300 enabled:hover:-translate-y-1 enabled:hover:bg-paper-sink"
                    style={{ opacity: faded ? 0.28 : 1, background: isPicked ? 'var(--sprout-wash)' : undefined }}
                  >
                    <Creature coat={k.coat} mane={k.mane} scale={2} fit />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
