import { useEffect, useRef } from 'react'
import { G_COAT, G_MANE, G_SIZE, trait, type Sim, type SimEvent } from '../sim/engine'
import { loadEevee, spriteFor, EEVEE_FEET, type IndexedSprite } from '../lib/sprites'

/* ------------------------------------------------------------------
   The field: a population of real Eevee sprites living on the page.

   Every generation the parents are replaced by their eggs, and each
   new creature hops out of the spot its mother stood in to where it
   settles. That one motion carries the whole idea: you are watching
   children leave their parents, slightly different every time, and
   over a few dozen hops the two sides of the river stop looking alike.

   Pixels. Everything is drawn in device pixels, and a sprite is always
   a whole number of them per game pixel: the size gene picks that
   number (bigger Eevee are drawn at the next whole scale up), never a
   fractional stretch. Positions are rounded to the pixel grid too.

   Room. The engine lets several creatures stand on nearly the same
   spot, which on screen is a brown clump nobody can read. So where they
   are drawn is the engine's position relaxed apart a little (a few
   passes of pairwise push, bounded to the creature's own bank). This is
   display only: the simulation, and so every share link, is untouched.

   Shadows are a soft contact patch under the feet, light enough that a
   crowd doesn't turn into a dark stain, and it stays on the ground while
   the sprite is in the air. The sprite uses Eevee's second anim_front
   frame mid-hop -- its own frame, not a drawn one.

   When the population splits, each side gives one hop, starting at the
   river and rolling outward, and the river sinks a shade deeper. It is
   the one celebration on the page and it comes from the thing itself.
------------------------------------------------------------------ */

export interface FieldHandle {
  /** how many ms one generation lasts; 0 pauses */
  genMs: number
  /** creature size as a fraction of the field's height */
  sprite: number
  /** performance.now() of the split moment; 0 for none */
  pulse?: number
}

interface P {
  x: number
  y: number
}

const PASSES = 8
const WAVE_MS = 900
const HOP_MS = 420

/* A soft elliptical patch, made once and scaled. */
let patch: HTMLCanvasElement | null = null
function contactPatch() {
  if (patch) return patch
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 32
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 0.25, 0, 0)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(40, 30, 20, 1)')
  g.addColorStop(0.55, 'rgba(40, 30, 20, 0.55)')
  g.addColorStop(1, 'rgba(40, 30, 20, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return (patch = c)
}

export function Field({
  sim,
  control,
  onStep,
  className = '',
  label,
  id,
}: {
  /** the simulation, read on every frame (swap it to restart) */
  sim: React.MutableRefObject<Sim>
  control: React.MutableRefObject<FieldHandle>
  onStep?: (events: SimEvent[]) => void
  className?: string
  label: string
  id?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stepRef = useRef(onStep)
  stepRef.current = onStep

  useEffect(() => {
    const cv = canvas.current!
    const ctx = cv.getContext('2d')!
    let sheet: IndexedSprite | null = null
    let raf = 0
    let visible = true
    let W = 0
    let H = 0
    let dpr = 1
    let last = performance.now()
    let acc = 0
    let genStart = performance.now()
    let animMs = 600
    let seen: Sim | null = null
    let laidFor = ''
    // where each creature is drawn this generation, and where it hops from
    let disp: P[] = []
    let from: P[] = []
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    loadEevee().then((s) => (sheet = s))

    const resize = () => {
      dpr = Math.min(3, window.devicePixelRatio || 1)
      W = Math.round(cv.clientWidth * dpr)
      H = Math.round(cv.clientHeight * dpr)
      cv.width = W
      cv.height = H
      laidFor = ''
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(cv)

    const geo = () => {
      const padX = Math.max(24 * dpr, W * 0.04)
      const top = H * 0.2
      const bottom = H * 0.07
      return {
        X: (x: number) => padX + x * (W - padX * 2),
        Y: (y: number) => top + y * (H - top - bottom),
        padX,
        top,
        bottom,
      }
    }

    /** whole device pixels per game pixel for one creature */
    const scaleOf = (s: Sim, i: number) => {
      const css = (H / dpr) * control.current.sprite * Math.exp(trait(s.creatures[i], G_SIZE) * 0.42)
      return Math.max(1, Math.round((css * dpr) / 64))
    }

    /* The engine's spots, pushed apart until neighbours have room. */
    const layout = (s: Sim): P[] => {
      const { X, Y, padX, top, bottom } = geo()
      const n = s.creatures.length
      const pts = s.creatures.map((c) => ({ x: X(c.x), y: Y(c.y) }))
      const half = s.creatures.map((_, i) => scaleOf(s, i) * 15)
      const rx = X(0.5)
      const riverGap = s.p.river ? 30 * dpr : 0
      for (let pass = 0; pass < PASSES; pass++) {
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) {
            const dx = pts[j].x - pts[i].x
            const dy = (pts[j].y - pts[i].y) * 1.3
            const need = half[i] + half[j]
            const d2 = dx * dx + dy * dy
            if (d2 >= need * need) continue
            const d = Math.sqrt(d2) || 0.01
            const push = (need - d) / 2
            const ux = d2 ? dx / d : (i % 2 ? 1 : -1)
            const uy = d2 ? dy / d / 1.3 : 0
            pts[i].x -= ux * push
            pts[i].y -= uy * push
            pts[j].x += ux * push
            pts[j].y += uy * push
          }
        for (let i = 0; i < n; i++) {
          const left = s.creatures[i].x < 0.5
          let lo = padX + half[i]
          let hi = W - padX - half[i]
          if (s.p.river) {
            if (left) hi = Math.min(hi, rx - riverGap - half[i])
            else lo = Math.max(lo, rx + riverGap + half[i])
          }
          pts[i].x = Math.min(hi, Math.max(lo, pts[i].x))
          pts[i].y = Math.min(H - bottom, Math.max(top, pts[i].y))
        }
      }
      return pts
    }

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(100, t - last)
      last = t
      if (!visible || document.hidden) return
      const s = sim.current
      const key = `${W}x${H}:${control.current.sprite}`
      if (s !== seen || key !== laidFor) {
        const fresh = s !== seen
        seen = s
        laidFor = key
        disp = layout(s)
        if (fresh) {
          from = disp
          genStart = t - 10_000
          acc = 0
        }
      }
      const { genMs, pulse = 0 } = control.current
      if (genMs > 0) {
        acc += dt
        if (acc >= genMs) {
          acc = 0
          const before = disp
          const ev = s.step()
          disp = layout(s)
          from = s.creatures.map((c, i) => before[c.mother] ?? disp[i])
          genStart = t
          animMs = reduce ? 0 : Math.min(620, genMs * 0.92)
          stepRef.current?.(ev)
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, W, H)
      if (!sheet) return

      const { X, top } = geo()
      const since = pulse ? t - pulse : -1
      const deep = since >= 0 && !reduce ? Math.min(1, since / 700) : since >= 0 ? 1 : 0

      if (s.p.river) {
        // the river is a gap in the ground, drawn as the page sinking a shade; it deepens at a split
        const rx = X(0.5)
        const half = (34 + deep * 10) * dpr
        const g = ctx.createLinearGradient(rx - half, 0, rx + half, 0)
        g.addColorStop(0, 'rgba(220, 216, 206, 0)')
        g.addColorStop(0.5, `rgba(206, 200, 188, ${0.55 + deep * 0.35})`)
        g.addColorStop(1, 'rgba(220, 216, 206, 0)')
        ctx.fillStyle = g
        ctx.fillRect(rx - half, top * 0.5, half * 2, H - top * 0.5)
      }

      const p = animMs ? Math.min(1, (t - genStart) / animMs) : 1
      const e = 1 - Math.pow(1 - p, 3)
      const order = disp.map((_, i) => i).sort((a, b) => disp[a].y - disp[b].y)
      const sh = contactPatch()
      const rx = X(0.5)

      for (const i of order) {
        const c = s.creatures[i]
        if (!c) continue
        const f = from[i] ?? disp[i]
        const gx = f.x + (disp[i].x - f.x) * e
        const gy = f.y + (disp[i].y - f.y) * e
        const k = scaleOf(s, i)
        let air = p < 1 ? Math.sin(Math.PI * p) : 0
        let hop = air * k * 64 * 0.32

        // the split: one hop each, rolling out from the river
        if (since >= 0 && !reduce) {
          const lt = since - (Math.abs(gx - rx) / W) * WAVE_MS
          if (lt > 0 && lt < HOP_MS) {
            const a = Math.sin((Math.PI * lt) / HOP_MS)
            air = Math.max(air, a)
            hop = Math.max(hop, a * k * 64 * 0.22)
          }
        }

        const spr = spriteFor(sheet, trait(c, G_COAT), trait(c, G_MANE))
        const img = spr.frames[air > 0.35 ? 1 : 0]

        // contact shadow: on the ground, smaller and fainter while the sprite is up
        const sw = 34 * k * (1 - air * 0.25)
        ctx.globalAlpha = 0.16 * (1 - air * 0.5)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(sh, gx - sw / 2 + 2 * k, gy - sw / 8, sw, sw / 4)
        ctx.globalAlpha = 1
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, Math.round(gx - 32 * k), Math.round(gy - EEVEE_FEET.y * k - hop), 64 * k, 64 * k)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [sim, control])

  return <canvas ref={canvas} id={id} className={className} role="img" aria-label={label} />
}
