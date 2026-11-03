import { useEffect, useMemo, useRef, useState } from 'react'
import { usePinnedProgress } from './pin'
import { drawFront, FRONT_FRAMES, loadFront, type FrontSheet } from '../lib/front'
import { GBA_HZ } from './hatch'
import { cssPx, deviceScale, useBoxWidth, useDpr } from '../lib/pixels'
import { displayScale } from '../save/genome'
import { HUE_STEP } from '../save/layout'
import CountUp from '../components/CountUp'

/* ------------------------------------------------------------------
   You choose who breeds.

   A pedigree that grows as you scroll. Each generation is a litter
   from the one kept before it; the kept one is under the PC's hand
   cursor, the real one from the storage system, bouncing on its two
   frames every 30 game frames (sAnim_Cursor_Bouncing). By default the
   hand keeps the biggest, and the line grows. Point at another and the
   hand opens over it; tap it and the hand closes, that one is kept,
   and every generation after it is bred from your choice instead.

   Size is the hack's size gene, shown at the ROM's display scale
   (240 + 4 x size) / 256, nearest-neighbour like the GBA's affine
   unit. Color drifts the way a real line does when nobody is choosing
   for it: a step of hue now and then, in either direction.
------------------------------------------------------------------ */

const GENS = 7

interface Kid {
  size: number
  hue: number
  coat: number
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function litter(parent: Kid, gen: number, path: number, n: number): Kid[] {
  const r = rng(gen * 7919 + path * 104729 + 17)
  return Array.from({ length: n }, () => {
    // Mendel's shuffle plus a little mutation: most kids land near the parent, some well off it
    const ds = Math.round((r() + r() + r() - 1.5) * 9)
    const dh = r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0
    return { size: Math.max(0, Math.min(68, parent.size + ds)), hue: parent.hue + dh, coat: parent.coat }
  })
}

const FOUNDER: Kid = { size: 5, hue: 0, coat: 0 }

/* A pedigree's own line: down from the parent, along the litter's bar, down to the child, with
   rounded elbows. Drawn left to right from the parent so the stroke animates outward. */
function elbow(px: number, py: number, x: number, y: number, bar: number) {
  if (Math.abs(x - px) < 1) return `M ${px} ${py} V ${y}`
  const r = Math.min(10, Math.abs(x - px) / 2, (bar - py) / 2)
  const d = x > px ? 1 : -1
  return `M ${px} ${py} V ${bar - r} Q ${px} ${bar} ${px + d * r} ${bar} H ${x - d * r} Q ${x} ${bar} ${x} ${bar + r} V ${y}`
}

/** CSS pixels from a row's bottom edge to the line its Eevee stand on. */
const FEET = 18

export function Pedigree() {
  const [ref, progress] = usePinnedProgress(GENS * 0.55)
  const dpr = useDpr()
  const [boxRef, wide] = useBoxWidth<HTMLDivElement>(1200)
  const kCss = wide < 700 ? 1 : 2
  const k = deviceScale(kCss, dpr)
  const n = wide < 700 ? 4 : 5
  const [picks, setPicks] = useState<(number | undefined)[]>([])
  const [front, setFront] = useState<FrontSheet | null>(null)
  useEffect(() => void loadFront().then(setFront), [])

  const gen = Math.min(GENS, Math.floor(progress * (GENS + 0.999)))

  /* Every row from the founder down, given the picks so far. A row's
     kept one is the pick if there is one, otherwise the biggest. */
  const rows = useMemo(() => {
    const out: { kids: Kid[]; kept: number }[] = [{ kids: [FOUNDER], kept: 0 }]
    let path = 0
    for (let g = 1; g <= GENS; g++) {
      const prev = out[g - 1]
      const kids = litter(prev.kids[prev.kept], g, path, n)
      const big = kids.reduce((b, c, i) => (c.size > kids[b].size ? i : b), 0)
      const kept = picks[g] ?? big
      path = path * 31 + kept + 1
      out.push({ kids, kept })
    }
    return out
  }, [picks, n])

  const ROW = Math.round(46 * 1.75 * kCss + 70)
  const headOf = (kid: Kid) => (46 * Math.max(1, Math.round(k * displayScale(kid.size)))) / dpr
  const cell = Math.round(Math.min(wide - 32, 860) / n)
  const keptNow = rows[gen].kids[rows[gen].kept]
  // the litter's bar sits halfway between the parent's feet and the tallest head below it
  const bar = Math.round((ROW - FEET - 46 * 1.75 * kCss) / 2)

  return (
    // React owns this wrapper; ScrollTrigger wraps the section inside it in its pin-spacer, so
    // unmounting removes a node React made rather than one GSAP moved
    <div>
    <section id="breed" ref={ref as React.RefObject<HTMLElement>} className="breed" aria-labelledby="breed-head">
      <div className="breed__head">
        <h2 id="breed-head" className="display text-hero">
          You choose who breeds.
        </h2>
        <p className="breed__read tc" aria-live="polite">
          <span>Generation {gen}</span>
          <span className="breed__size">
            <CountUp to={Math.round(displayScale(keptNow.size) * 100) / 100} from={0.98} duration={0.6} startWhen />x
          </span>
        </p>
      </div>

      <div className="breed__view" ref={boxRef}>
        <div
          className="breed__tree"
          style={{ transform: `translateY(${-gen * ROW}px)`, width: cell * n }}
        >
          {rows.map((row, g) => {
            const shown = g <= gen
            const xs = row.kids.map((_, i) => (row.kids.length === 1 ? (cell * n) / 2 : cell * (i + 0.5)))
            const parentX = g > 0 ? (rows[g - 1].kids.length === 1 ? (cell * n) / 2 : cell * (rows[g - 1].kept + 0.5)) : 0
            return (
              <div
                key={g}
                className="breed__row"
                data-on={shown}
                data-past={g < gen}
                style={{ top: g * ROW, height: ROW }}
              >
                {g > 0 && (
                  <svg className="breed__lines" width={cell * n} height={ROW} aria-hidden="true">
                    {xs.map((x, i) => (
                      <path
                        key={i}
                        pathLength={1}
                        d={elbow(parentX, -FEET + 8, x, ROW - FEET - headOf(row.kids[i]) - 12, bar)}
                        style={{ transitionDelay: `${i * 60}ms` }}
                        data-kept={i === row.kept}
                      />
                    ))}
                  </svg>
                )}
                {row.kids.map((kid, i) => (
                  <Pick
                    key={`${g}-${i}`}
                    kid={kid}
                    x={xs[i]}
                    k={k}
                    dpr={dpr}
                    front={front}
                    kept={i === row.kept}
                    live={g === gen && g > 0}
                    delay={i * 70}
                    onPick={() =>
                      setPicks((p) => {
                        const next = p.slice(0, g)
                        next[g] = i
                        return next
                      })
                    }
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </section>
    </div>
  )
}

/* One Eevee in the pedigree: its front sprite at its size, feet on the
   row's line, a hand above it if it's the kept one. The current row's
   kids are buttons. */
function Pick({
  kid,
  x,
  k,
  dpr,
  front,
  kept,
  live,
  delay,
  onPick,
}: {
  kid: Kid
  x: number
  k: number
  dpr: number
  front: FrontSheet | null
  kept: boolean
  live: boolean
  delay: number
  onPick: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scale = displayScale(kid.size)
  const kd = Math.max(1, Math.round(k * scale))
  const look = useMemo(() => ({ coat: kid.coat, hue: kid.hue * HUE_STEP }), [kid.coat, kid.hue])
  const [hover, setHover] = useState(false)
  const [grab, setGrab] = useState(false)

  // drawn at whole device pixels per game pixel for its size; the front animation plays when it is kept
  useEffect(() => {
    const cv = ref.current
    if (!cv || !front) return
    cv.width = 64 * kd
    cv.height = 64 * kd
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (f: number | null) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(kd, 0, 0, kd, 0, 0)
      drawFront(ctx, front, look, 32, 32, f)
    }
    draw(null)
    if (!kept || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now()
    const step = (now: number) => {
      const f = ((now - t0) / 1000) * GBA_HZ
      draw(f < FRONT_FRAMES ? f : null)
      if (f < FRONT_FRAMES) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [front, kd, look, kept])

  // the button is Eevee's own box in its 64x64 cell (x 11-48, y 10-55), so the hit area is the Pokémon
  const u = kd / dpr
  const size = 64 * u
  const handK = deviceScale(2, dpr)
  const hand = cssPx(32, handK, dpr)
  const frame = grab ? 3 : hover && !kept ? 2 : -1

  return (
    <button
      type="button"
      className="breed__kid"
      data-kept={kept}
      disabled={!live}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => (setHover(false), setGrab(false))}
      onPointerDown={() => setGrab(true)}
      onPointerUp={() => setGrab(false)}
      onClick={onPick}
      aria-label={`Keep this one, ${scale.toFixed(2)}x`}
      aria-pressed={kept}
      style={{ left: x - 19 * u, bottom: FEET, width: 38 * u, height: 46 * u, transitionDelay: `${delay}ms` }}
    >
      <canvas ref={ref} className="px breed__sprite" style={{ width: size, height: size, left: -11 * u, top: -9 * u }} aria-hidden="true" />
      {(kept || (live && hover)) && (
        <span
          className="breed__hand px"
          data-frame={frame}
          aria-hidden="true"
          style={{
            width: hand,
            height: hand,
            bottom: `calc(100% + 2px)`,
            backgroundSize: `${hand}px ${hand * 4}px`,
            ['--hand' as string]: `${hand}px`,
          }}
        />
      )}
    </button>
  )
}
