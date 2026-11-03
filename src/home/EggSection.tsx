import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { blendWhite, drawHatch, GBA_HZ, hatchAt, HATCH_REVEAL, loadEggArt, type EggArt } from './hatch'
import { drawFront, FRONT_FRAMES, loadFront, type FrontSheet } from '../lib/front'
import type { Look } from '../lib/follower'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'
import { HUE_STEP } from '../save/layout'
import { Rise } from '../components/Rise'

/* ------------------------------------------------------------------
   Every egg can mutate.

   One egg, center stage, running Emerald's hatch at the game's own
   pace: it sits, shakes, cracks, shakes, cracks, shakes hard, goes
   white and bursts, and an Eevee rises out of it at the Emerge scale
   and does its front animation, frame for frame (hatch.ts, lib/front.ts).

   The Eevee is a mutant. Its genes are drawn the way the hack's eggs
   draw them -- usually a few steps of hue, now and then a coat (albino,
   red, black), rarely a shiny -- and its colors come out of the ROM's
   own palette function. Then it drops onto a shelf below, next to the
   ones that hatched before it, and a new egg drops in. The shelf is
   the argument: no two the same.

   It runs on its own while it is on screen, like frame's Quick Find
   walks its own selection, and stops when it isn't. Clicking the egg
   hatches it now. Reduced motion skips the cutscene: a click puts the
   hatchling straight on the shelf.
------------------------------------------------------------------ */

const START = 30 // the scene's first frames are the fade in from black; the egg is already sitting here
const HOLD = 50 // game frames the hatchling stays up after its animation, before it drops
const BETWEEN = 1600 // ms from a new egg landing to the next hatch, when it runs on its own

interface Hatchling extends Look {
  id: number
}

function mutant(seed: number): Hatchling {
  let s = seed * 2654435761
  const r = () => ((s = (s ^ (s >>> 15)) * 2246822519 + 0x9e3779b9) >>> 0) / 4294967296
  const roll = r()
  const step = () => (r() < 0.5 ? -1 : 1) * (2 + Math.floor(r() * 9))
  if (roll < 0.1) return { id: seed, coat: 1, hue: 0 }
  if (roll < 0.18) return { id: seed, coat: 2, hue: 0 }
  if (roll < 0.27) return { id: seed, coat: 3, hue: 0 }
  if (roll < 0.31) return { id: seed, coat: 0, hue: 0, shiny: true }
  return { id: seed, coat: 0, hue: step() * HUE_STEP }
}

export function EggSection() {
  const dpr = useDpr()
  /* Start small and grow once measured: a first render wider than a phone makes mobile browsers
     zoom the whole page out to fit it, and then the measurement sees the zoomed-out width. */
  const [kCss, setKCss] = useState(2)
  const [W, setW] = useState(160)
  const H = 100
  const ORIGIN = useMemo<[number, number]>(() => [W / 2, 62], [W])
  const k = deviceScale(kCss, dpr)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [art, setArt] = useState<{ egg: EggArt; front: FrontSheet } | null>(null)
  const [shelf, setShelf] = useState<Hatchling[]>([])
  const [max, setMax] = useState(10)
  const [shelfK, setShelfK] = useState(2)
  const run = useRef<{ start: number; mon: Hatchling } | null>(null)
  const next = useRef(1)
  const live = useRef(false)
  const timer = useRef(0)
  const raf = useRef(0)
  const eggIn = useRef(0)
  const reduce = useRef(false)
  const hatchRef = useRef<() => void>(() => {})
  const [busy, setBusy] = useState(false)
  const [press, setPress] = useState(false)

  useEffect(() => {
    reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    const fit = () => {
      const wide = document.documentElement.clientWidth
      const kk = wide < 700 ? 3 : wide < 1100 ? 4 : 5
      setKCss(kk)
      setW(Math.min(200, Math.floor((Math.min(wide, 1200) - 32) / kk)))
      setMax(wide < 700 ? 6 : wide < 1100 ? 8 : 10)
      setShelfK(wide < 700 ? 1 : 2)
    }
    fit()
    addEventListener('resize', fit)
    let alive = true
    Promise.all([loadEggArt(), loadFront()]).then(([egg, front]) => alive && setArt({ egg, front }))
    return () => {
      alive = false
      removeEventListener('resize', fit)
      cancelAnimationFrame(raf.current)
      clearTimeout(timer.current)
    }
  }, [])

  const paint = useCallback(
    (now: number) => {
      const cv = canvas.current
      if (!cv || !art) return
      const ctx = cv.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      const r = run.current
      const f = r ? START + ((now - r.start) / 1000) * GBA_HZ : 0
      const s = hatchAt(r ? Math.min(f, HATCH_REVEAL) : 0)
      if (!r) {
        // a fresh egg drops in: the house drop, a few game pixels, whole pixels only
        const t = Math.min(1, (now - eggIn.current) / 420)
        s.eggX = 0
        ctx.translate(0, -Math.round((1 - (1 - (1 - t) ** 3)) * 10))
        ctx.globalAlpha = Math.min(1, t * 2.5)
      }
      drawHatch(ctx, art.egg, s, ORIGIN, (c, x, y, scale) => r && drawFront(c, art.front, r.mon, x, y, f > HATCH_REVEAL ? f - HATCH_REVEAL : null, scale))
      ctx.globalAlpha = 1
      blendWhite(ctx, s.obj)
      // the game fades the whole screen; here the stage's own patch of paper lightens with it
      if (stage.current) stage.current.style.setProperty('--flash', String(s.bg / 16))
    },
    [art, k, ORIGIN],
  )

  useEffect(() => {
    const cv = canvas.current
    if (!cv || !art) return
    cv.width = W * k
    cv.height = H * k
    eggIn.current = performance.now() - 1000
    paint(performance.now())
  }, [art, k, W, paint])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    if (!live.current || reduce.current) return
    timer.current = window.setTimeout(() => hatchRef.current(), BETWEEN)
  }, [])

  const settle = useCallback(() => {
    const now = performance.now()
    eggIn.current = now
    const tick = (t: number) => {
      paint(t)
      if (t - eggIn.current < 450) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    schedule()
  }, [paint, schedule])

  const hatch = useCallback(() => {
    if (!art || run.current) return
    const mon = mutant(next.current++)
    clearTimeout(timer.current)
    if (reduce.current) {
      setShelf((sh) => [...sh, mon].slice(-max))
      return
    }
    run.current = { start: performance.now(), mon }
    setBusy(true)
    const end = START + (HATCH_REVEAL - START) + FRONT_FRAMES + HOLD
    const loop = (now: number) => {
      paint(now)
      const f = START + ((now - run.current!.start) / 1000) * GBA_HZ
      if (f < end) return void (raf.current = requestAnimationFrame(loop))
      setShelf((sh) => [...sh, mon].slice(-max))
      run.current = null
      setBusy(false)
      settle()
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }, [art, paint, settle, max])
  hatchRef.current = hatch

  // runs on its own only while it's on screen
  useEffect(() => {
    const el = stage.current
    if (!el || !art) return
    const io = new IntersectionObserver(
      ([e]) => {
        live.current = e.isIntersecting
        if (e.isIntersecting && !run.current) schedule()
        else if (!e.isIntersecting) clearTimeout(timer.current)
      },
      { threshold: 0.45 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [art, schedule])

  // the hand at two game pixels per CSS pixel less than the egg, whole either way
  const hand = cssPx(32, deviceScale(Math.max(2, kCss - 2), dpr), dpr)

  return (
    <section id="egg" className="egg" aria-labelledby="egg-head">
      <Rise className="text-center">
        <h2 id="egg-head" className="display text-hero">
          Every egg can mutate.
        </h2>
      </Rise>

      <div ref={stage} className="egg__stage">
        <button
          type="button"
          className="egg__button"
          onClick={hatch}
          onPointerDown={() => setPress(true)}
          onPointerUp={() => setPress(false)}
          onPointerLeave={() => setPress(false)}
          aria-label="Hatch the egg"
          style={{ width: cssPx(W, k, dpr), height: cssPx(H, k, dpr) }}
        >
          <canvas ref={canvas} className="px block" style={{ width: cssPx(W, k, dpr), height: cssPx(H, k, dpr) }} />
          {/* the PC's hand, bouncing over the egg until it hatches: this is the thing to press */}
          {!busy && art && (
            <span
              className="breed__hand px egg__hand"
              data-frame={press ? 3 : -1}
              aria-hidden="true"
              style={{
                width: hand,
                height: hand,
                left: cssPx(ORIGIN[0] + 2, k, dpr),
                top: cssPx(ORIGIN[1] - 12, k, dpr) - hand * 0.94,
                backgroundSize: `${hand}px ${hand * 4}px`,
                ['--hand' as string]: `${hand}px`,
              }}
            />
          )}
        </button>
      </div>

      <Shelf items={shelf} from={stage} stageK={kCss} k={shelfK} />
    </section>
  )
}

/* ------------------------------------------------------------------
   The shelf. Each hatchling lands here at two CSS pixels per game pixel
   (one on a phone), flying down from where it hatched
   and shrinking on the way, on the page's one ease. Then it lives:
   every few seconds it does its front animation again, the way a
   Pokémon on the summary screen does when you flip to it.
------------------------------------------------------------------ */

function Shelf({ items, from, stageK, k }: { items: Hatchling[]; from: React.RefObject<HTMLDivElement | null>; stageK: number; k: number }) {
  return (
    <div className="egg__shelf" aria-label={`${items.length} hatched so far`}>
      {items.map((m) => (
        <ShelfMon key={m.id} mon={m} from={from} stageK={stageK} scale={k} />
      ))}
    </div>
  )
}

function ShelfMon({ mon, from, stageK, scale }: { mon: Hatchling; from: React.RefObject<HTMLDivElement | null>; stageK: number; scale: number }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [front, setFront] = useState<FrontSheet | null>(null)

  useEffect(() => {
    loadFront().then(setFront)
  }, [])

  // the flight: from the hatch spot on the stage, at its size there, into this slot
  useLayoutEffect(() => {
    const el = box.current
    const st = from.current
    if (!el || !st || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const a = el.getBoundingClientRect()
    const b = st.getBoundingClientRect()
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height * (57 / 100) - (a.top + a.height / 2)
    const c = animate(el, { x: [dx, 0], y: [dy, 0], scale: [stageK / scale, 1] }, { duration: 0.75, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !front) return
    cv.width = 64 * k
    cv.height = 64 * k
    const ctx = cv.getContext('2d')!
    let raf = 0
    let timer = 0
    const draw = (f: number | null) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      drawFront(ctx, front, mon, 32, 32, f)
    }
    draw(null)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const play = () => {
      const t0 = performance.now()
      const step = (now: number) => {
        const f = ((now - t0) / 1000) * GBA_HZ
        draw(f < FRONT_FRAMES ? f : null)
        if (f < FRONT_FRAMES) raf = requestAnimationFrame(step)
        else timer = window.setTimeout(play, 3500 + Math.random() * 5000)
      }
      raf = requestAnimationFrame(step)
    }
    timer = window.setTimeout(play, 2500 + Math.random() * 4000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [front, mon, k])

  // the slot is Eevee's own width (x 11-48 of the 64x64 cell, plus air), not the empty cell
  const size = cssPx(64, k, dpr)
  return (
    <div ref={box} className="egg__slot" style={{ width: cssPx(42, k, dpr), height: size }}>
      <canvas ref={ref} className="px absolute top-0 block" style={{ width: size, height: size, left: -cssPx(11, k, dpr) }} aria-hidden="true" />
    </div>
  )
}
