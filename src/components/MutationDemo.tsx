import { useRef, useState } from 'react'
import { Creature } from './Creature'
import { rng } from '../sim/engine'

/* ------------------------------------------------------------------
   Hatch an egg. The egg is Emerald's, and so is the way it hatches:
   it wobbles as hatch_0, cracks through hatch_1 and hatch_2, the
   screen goes white, and the baby is there. The timing is shortened
   from the game's 10.7 s to about a second and a half, because here
   you are going to press it twenty times.

   Each baby gets one copy of the coat gene from each parent, and each
   copy can mutate -- the same draw as the engine, with the same odds of
   a big jump. Most babies look like their parents. Keep pressing.
------------------------------------------------------------------ */

const MOM = 0.04
const DAD = -0.06

type Stage = 'idle' | 'wobble' | 'crack1' | 'crack2' | 'flash'

export function MutationDemo() {
  const r = useRef(rng(20261102))
  const [kids, setKids] = useState<{ id: number; coat: number; mane: number; odd: boolean }[]>(() => [
    // three earlier eggs, so the row is never an empty shelf
    { id: -1, coat: -0.01, mane: 0.05, odd: false },
    { id: -2, coat: 0.31, mane: -0.08, odd: true },
    { id: -3, coat: 0.02, mane: 0.1, odd: false },
  ])
  const [stage, setStage] = useState<Stage>('idle')
  const nextId = useRef(1)

  const hatch = () => {
    if (stage !== 'idle') return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const mutate = (v: number) => {
      if (r.current.next() > 0.5) return v
      const big = r.current.next() < 0.18
      return v + r.current.gauss() * (big ? 0.38 : 0.05)
    }
    const coat = (mutate(MOM) + mutate(DAD)) / 2
    const mane = r.current.gauss() * 0.12
    const kid = { id: nextId.current++, coat, mane, odd: Math.abs(coat - (MOM + DAD) / 2) > 0.1 }
    if (reduce) {
      setKids((k) => [kid, ...k].slice(0, 6))
      return
    }
    const seq: [Stage, number][] = [['wobble', 0], ['crack1', 520], ['crack2', 860], ['flash', 1180], ['idle', 1330]]
    seq.forEach(([s, t]) =>
      setTimeout(() => {
        setStage(s)
        if (s === 'idle') setKids((k) => [kid, ...k].slice(0, 6))
      }, t),
    )
  }

  const egg = stage === 'crack1' ? '/game/hatch_1.png' : stage === 'crack2' || stage === 'flash' ? '/game/hatch_2.png' : '/game/hatch_0.png'

  return (
    <div className="rounded-card bg-paper-lift p-6 shadow-card sm:p-8">
      <div className="flex items-end justify-center gap-1 sm:gap-6">
        <div className="max-w-32 min-w-0 flex-1"><Creature coat={MOM} scale={2} fluid label="Mother Eevee" /></div>
        <div className="relative grid h-[128px] w-[96px] shrink-0 sm:w-[112px] place-items-end justify-center pb-2">
          <img
            src={egg}
            width={32}
            height={32}
            alt=""
            className="px h-24 w-24"
            style={{
              animation: stage === 'wobble' || stage === 'crack1' ? 'egg-wobble 260ms steps(2) infinite' : undefined,
              filter: 'drop-shadow(6px 9px 7px rgba(40,30,20,.28))',
            }}
          />
          {stage === 'flash' && <div className="absolute inset-[-40px] rounded-full bg-white" style={{ animation: 'flash 150ms linear both' }} />}
        </div>
        <div className="max-w-32 min-w-0 flex-1"><Creature coat={DAD} scale={2} fluid label="Father Eevee" /></div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button className="btn btn-ink btn-sm" onClick={hatch} disabled={stage !== 'idle'}>
          Hatch an egg
        </button>
        <p className="text-right text-meta text-ash">{kids.length ? `${kids.filter((k) => k.odd).length} of ${kids.length} came out different` : 'Each egg rolls its own mutations'}</p>
      </div>

      <ol className="mt-5 flex min-h-[98px] items-end gap-1 overflow-hidden" aria-label="Babies so far, newest first">
        {kids.map((k, i) => (
          <li key={k.id} style={{ animation: i === 0 ? 'drop 520ms var(--ease-spring) both' : undefined }}>
            <Creature coat={k.coat} mane={k.mane} scale={1} label={k.odd ? 'A baby with a mutated coat' : 'A baby that looks like its parents'} />
          </li>
        ))}
      </ol>
      <style>{`
        @keyframes egg-wobble { 0% { transform: rotate(-7deg) } 100% { transform: rotate(7deg) } }
        @keyframes flash { from { opacity: 1 } to { opacity: 0 } }
        @keyframes drop { from { opacity: 0; transform: translateY(-26px) scale(1.04, .9) } 60% { transform: translateY(2px) scale(1.06, .93) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}
