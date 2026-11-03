import { useRef, useState } from 'react'
import { Creature } from './Creature'
import { rng } from '../sim/engine'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   Hatch an egg. The egg is Emerald's, and so is the way it hatches:
   it shakes sideways as hatch_0, cracks through hatch_1 and hatch_2, the
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
  const dpr = useDpr()
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

  const eggPx = cssPx(32, deviceScale(3, dpr), dpr)
  const egg = stage === 'crack1' ? '/game/hatch_1.png' : stage === 'crack2' || stage === 'flash' ? '/game/hatch_2.png' : '/game/hatch_0.png'

  return (
    <div className="rounded-card bg-paper-lift p-6 shadow-card sm:p-8">
      <div className="flex items-end justify-center gap-1 sm:gap-6">
        <div className="flex max-w-32 min-w-0 flex-1 justify-center"><Creature coat={MOM} scale={2} fit label="Mother Eevee" /></div>
        <div className="relative grid h-[128px] w-[96px] shrink-0 sm:w-[112px] place-items-end justify-center pb-2">
          <img
            src={egg}
            width={32}
            height={32}
            alt=""
            className="px"
            style={{
              width: eggPx,
              height: eggPx,
              ['--gp' as string]: `${eggPx / 32}px`,
              animation: stage === 'wobble' ? 'egg-shake 300ms steps(1) infinite' : stage === 'crack1' ? 'egg-shake-hard 240ms steps(1) infinite' : undefined,
              filter: 'drop-shadow(6px 9px 7px rgba(40,30,20,.28))',
            }}
          />
          {stage === 'flash' && <div className="absolute inset-[-40px] rounded-full bg-white" style={{ animation: 'flash 150ms linear both' }} />}
        </div>
        <div className="flex max-w-32 min-w-0 flex-1 justify-center"><Creature coat={DAD} scale={2} fit flip label="Father Eevee" /></div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button className="btn btn-ink btn-sm" onClick={hatch} disabled={stage !== 'idle'}>
          Hatch an egg
        </button>
        <p className="text-right text-meta text-ash">{kids.length ? `${kids.filter((k) => k.odd).length} of ${kids.length} came out different` : 'Each egg rolls its own mutations'}</p>
      </div>

      <ol className="mt-5 flex min-h-[64px] items-end gap-3 overflow-hidden" aria-label="Babies so far, newest first">
        {kids.map((k, i) => (
          <li key={k.id} style={{ animation: i === 0 ? 'drop 520ms var(--ease-spring) both' : undefined }}>
            <Creature coat={k.coat} mane={k.mane} scale={1} label={k.odd ? 'A baby with a mutated coat' : 'A baby that looks like its parents'} />
          </li>
        ))}
      </ol>
      <style>{`
        /* egg_hatch.c shakes the egg sideways, x2 = Sin(i, 1) then Sin(i, 2): whole game pixels, no rotation */
        @keyframes egg-shake { 0%, 100% { transform: none } 25% { transform: translateX(var(--gp)) } 75% { transform: translateX(calc(var(--gp) * -1)) } }
        @keyframes egg-shake-hard { 0%, 100% { transform: none } 12.5%, 37.5% { transform: translateX(var(--gp)) } 25% { transform: translateX(calc(var(--gp) * 2)) } 62.5%, 87.5% { transform: translateX(calc(var(--gp) * -1)) } 75% { transform: translateX(calc(var(--gp) * -2)) } }
        @keyframes flash { from { opacity: 1 } to { opacity: 0 } }
        @keyframes drop { from { opacity: 0; transform: translateY(-26px) } 70% { opacity: 1; transform: translateY(2px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}
