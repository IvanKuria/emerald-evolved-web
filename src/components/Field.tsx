import { useEffect, useRef } from 'react'
import { G_COAT, G_MANE, G_SIZE, trait, type Sim, type SimEvent } from '../sim/engine'
import { loadEevee, spriteFor, SHADOW, type IndexedSprite } from '../lib/sprites'

/* ------------------------------------------------------------------
   The field: a population of real Eevee sprites living on the page.

   Every generation the parents are replaced by their eggs, and each
   new creature hops out of the spot its mother stood in to where it
   settles. That one motion carries the whole idea: you are watching
   children leave their parents, slightly different every time, and
   over a few dozen hops the two sides of the river stop looking alike.

   House physics, from HOUSE_STYLE.md: things travel on arcs, squash a
   little when they land, and the shadow stays on the ground while the
   sprite is in the air. The sprite switches to its second animation
   frame mid-hop -- Eevee's own anim_front frame, not a drawn one.

   One canvas, drawn back to front by height on the ground. Sprites are
   cached per gene pair (lib/sprites.ts), so a frame is a few dozen
   drawImage calls and nothing else.
------------------------------------------------------------------ */

export interface FieldHandle {
  /** how many ms one generation lasts; 0 pauses */
  genMs: number
  /** creature size as a fraction of the field's height */
  sprite: number
}

interface Pos {
  fx: number
  fy: number
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
    let w = 0
    let h = 0
    let dpr = 1
    let last = performance.now()
    let acc = 0
    let genStart = performance.now()
    let animMs = 600
    let from: Pos[] = []
    let seen: Sim | null = null
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    loadEevee().then((s) => (sheet = s))

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    resize()

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(cv)

    const snapshot = () => sim.current.creatures.map((c) => ({ fx: c.x, fy: c.y }))

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(100, t - last)
      last = t
      if (!visible || document.hidden) return
      const s = sim.current
      if (s !== seen) {
        seen = s
        from = snapshot()
        genStart = t - 10_000
        acc = 0
      }
      const { genMs, sprite } = control.current
      if (genMs > 0) {
        acc += dt
        if (acc >= genMs) {
          acc = 0
          const before = snapshot()
          const ev = s.step()
          from = s.creatures.map((c) => before[c.mother] ?? { fx: c.x, fy: c.y })
          genStart = t
          animMs = reduce ? 0 : Math.min(620, genMs * 0.92)
          stepRef.current?.(ev)
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!sheet) return

      const padX = Math.max(24, w * 0.04)
      const top = h * 0.16
      const bottom = h * 0.06
      const X = (x: number) => padX + x * (w - padX * 2)
      const Y = (y: number) => top + y * (h - top - bottom)

      if (s.p.river) {
        // the river is a gap in the ground, drawn as the page sinking a shade
        const rx = X(0.5)
        const g = ctx.createLinearGradient(rx - 34, 0, rx + 34, 0)
        g.addColorStop(0, 'rgba(220, 216, 206, 0)')
        g.addColorStop(0.5, 'rgba(214, 209, 198, 0.55)')
        g.addColorStop(1, 'rgba(220, 216, 206, 0)')
        ctx.fillStyle = g
        ctx.fillRect(rx - 34, top * 0.55, 68, h - top * 0.55)
      }

      const p = animMs ? Math.min(1, (t - genStart) / animMs) : 1
      const order = s.creatures.map((_, i) => i).sort((a, b) => s.creatures[a].y - s.creatures[b].y)
      const base = h * sprite
      ctx.imageSmoothingEnabled = false

      for (const i of order) {
        const c = s.creatures[i]
        const f = from[i] ?? { fx: c.x, fy: c.y }
        const e = 1 - Math.pow(1 - p, 3)
        const gx = X(f.fx + (c.x - f.fx) * e)
        const gy = Y(f.fy + (c.y - f.fy) * e)
        const air = p < 1 ? Math.sin(Math.PI * p) : 0
        const size = base * Math.exp(trait(c, G_SIZE) * 0.42)
        const hop = air * size * 0.32
        const land = p > 0.82 && p < 1 ? Math.sin(((p - 0.82) / 0.18) * Math.PI) : 0
        const sx = size * (1 + land * 0.07)
        const sy = size * (1 - land * 0.09)
        const spr = spriteFor(sheet, trait(c, G_COAT), trait(c, G_MANE))
        const img = spr.frames[air > 0.35 ? 1 : 0]

        // shadow stays on the ground and tightens while the sprite is up
        const sh = spr.shadow
        const k = sx / 64
        const pad = SHADOW.pad * 4
        ctx.globalAlpha = SHADOW.alpha * (1 - air * 0.45)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(
          sh,
          gx - sx / 2 + SHADOW.dx * size - (pad * k) / 4,
          gy - sy + SHADOW.dy * size - (pad * k) / 4,
          (sh.width * k) / 4,
          (sh.height * k) / 4,
        )
        ctx.globalAlpha = 1
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, gx - sx / 2, gy - sy - hop, sx, sy)
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
