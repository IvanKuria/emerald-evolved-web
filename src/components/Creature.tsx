import { useEffect, useRef, useState } from 'react'
import { loadEevee, spriteFor, SHADOW, EEVEE_BOX } from '../lib/sprites'
import { cssPx, deviceScale, fitScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   One Eevee with given genes, with the house drop shadow. Used wherever
   the page talks about one creature rather than a population.

   It is laid out by the Eevee itself, not by its 64x64 cell: the box is
   the sprite's visible pixels (EEVEE_BOX), and the shadow paints past
   it without pushing anything around. The scale is always a whole
   number of screen pixels per game pixel (lib/pixels.ts). With `fit`,
   it is the largest such scale that fits the parent's width, capped at
   `scale`.
------------------------------------------------------------------ */

const B = EEVEE_BOX
// how far the canvas reaches past the layout box, in game pixels, so the shadow has room
const OVER = { l: 4, t: 4, r: 18, b: 16 }

export function Creature({
  coat,
  mane = 0,
  scale = 2,
  frame = 0,
  flip = false,
  fit = false,
  className = '',
  label,
}: {
  coat: number
  mane?: number
  /** CSS pixels per game pixel (the maximum when `fit`) */
  scale?: number
  frame?: number
  /** face right; the shadow still falls down-right */
  flip?: boolean
  /** shrink by whole steps to fit the parent's width */
  fit?: boolean
  className?: string
  label?: string
}) {
  const dpr = useDpr()
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const max = deviceScale(scale, dpr)
  const [k, setK] = useState(max)

  useEffect(() => {
    if (!fit) return setK(max)
    const el = box.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => setK(fitScale(e.contentRect.width, B.w, dpr, max)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, max, dpr])

  useEffect(() => {
    let alive = true
    loadEevee().then((s) => {
      const cv = ref.current
      if (!alive || !cv) return
      const spr = spriteFor(s, coat, mane)
      const W = B.w + OVER.l + OVER.r
      const H = B.h + OVER.t + OVER.b
      cv.width = W * k
      cv.height = H * k
      const ctx = cv.getContext('2d')!
      // origin at the sprite cell's top-left, in device pixels
      const ox = -(B.x - OVER.l) * k
      const oy = -(B.y - OVER.t) * k
      const mirror = (draw: () => void) => {
        ctx.save()
        if (flip) {
          ctx.translate(ox * 2 + 64 * k, 0)
          ctx.scale(-1, 1)
        }
        draw()
        ctx.restore()
      }
      ctx.globalAlpha = SHADOW.alpha
      ctx.imageSmoothingEnabled = true
      const sh = spr.shadow
      const pad = SHADOW.pad * k
      // the light is fixed, so the shadow's offset is not mirrored, only its shape
      ctx.save()
      ctx.translate(SHADOW.dx * 64 * k, SHADOW.dy * 64 * k)
      mirror(() => ctx.drawImage(sh, ox - pad, oy - pad, (sh.width * k) / 4, (sh.height * k) / 4))
      ctx.restore()
      ctx.globalAlpha = 1
      ctx.imageSmoothingEnabled = false
      mirror(() => ctx.drawImage(spr.frames[frame], ox, oy, 64 * k, 64 * k))
    })
    return () => {
      alive = false
    }
  }, [coat, mane, k, frame, flip])

  return (
    <span
      ref={box}
      className={`relative inline-block align-bottom ${className}`}
      style={{ width: cssPx(B.w, k, dpr), height: cssPx(B.h, k, dpr) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas
        ref={ref}
        className="pointer-events-none absolute"
        style={{
          left: -cssPx(OVER.l, k, dpr),
          top: -cssPx(OVER.t, k, dpr),
          width: cssPx(B.w + OVER.l + OVER.r, k, dpr),
          height: cssPx(B.h + OVER.t + OVER.b, k, dpr),
        }}
      />
    </span>
  )
}
