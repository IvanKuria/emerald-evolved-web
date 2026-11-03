import { useEffect, useRef, useState } from 'react'
import { useMarqueeItem } from '../components/fancy/marquee-along-svg-path'
import { useDpr } from '../lib/pixels'
import { FOLLOWER_MAX_SCALE, feetOf, frameFor, loadFollower, loadShadow, paintFollower, type Facing, type FollowerSheet, type Look } from '../lib/follower'

/* ------------------------------------------------------------------
   One Eevee walking on a belt.

   It reads the belt's motion from the item it sits in (useMarqueeItem):
   the direction decides which way it faces, the distance the belt has
   run decides which foot is down, and its place on the path can decide
   its genes (the lower arc uses that: the further along, the further
   evolved). Nothing here re-renders per frame; the canvas is redrawn
   only when the frame, the colors or the size actually change.

   Sizes are whole device pixels per game pixel: `k` at 1.0x, and the
   size gene picks the nearest whole multiple above it, so a big Eevee
   is drawn at 5 or 6 device pixels per game pixel where a wild one is
   at 4, never at 4.37.
------------------------------------------------------------------ */

export interface Genes extends Look {
  /** the ROM's display scale, 1.0 for a wild one */
  scale: number
}

/** Game pixels of room under the feet, for the shadow. */
export const UNDER = 3

export function walkerBox(k: number) {
  const w = Math.ceil(32 * k * FOLLOWER_MAX_SCALE)
  return { w, h: w + UNDER * k }
}

export function Walker({
  k,
  genes,
  pxPerPercent,
  phase = 0,
  forward = 'east',
  className,
}: {
  /** device pixels per game pixel at 1.0x */
  k: number
  /** genes at a place on the path, t = 0..1 */
  genes: (t: number) => Genes
  /** game pixels walked per percent of the path the belt runs */
  pxPerPercent: number
  /** game pixels, so the herd doesn't step in unison */
  phase?: number
  /** which way "along the path" is on screen */
  forward?: Facing
  className?: string
}) {
  const item = useMarqueeItem()
  const ref = useRef<HTMLCanvasElement>(null)
  const [sheet, setSheet] = useState<FollowerSheet | null>(null)
  const [shadow, setShadow] = useState<HTMLCanvasElement | null>(null)
  const box = walkerBox(k)
  const dpr = useDpr()

  useEffect(() => {
    let alive = true
    Promise.all([loadFollower(), loadShadow()]).then(([s, sh]) => {
      if (alive) (setSheet(s), setShadow(sh))
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !sheet || !shadow) return
    cv.width = box.w
    cv.height = box.h
    const ctx = cv.getContext('2d')!
    const feet = feetOf(sheet)
    const backward: Facing = forward === 'east' ? 'west' : forward === 'west' ? 'east' : forward === 'south' ? 'north' : 'south'
    let facing: Facing = forward
    let last = ''

    const draw = () => {
      const t = item ? item.offset.get() / 100 : 0.5
      const v = item ? item.velocity.get() : 0
      if (v > 0.04) facing = forward
      else if (v < -0.04) facing = backward
      const moving = Math.abs(v) > 0.04
      const walked = item ? item.travelled.get() * pxPerPercent * (facing === forward ? 1 : -1) + phase : 0
      const g = genes(t)
      const s = Math.max(1, Math.round(k * Math.min(FOLLOWER_MAX_SCALE, g.scale)))
      const { index, flip } = frameFor(facing, moving ? ((walked % 1e6) + 1e6) % 1e6 : null)
      const key = `${index}|${flip}|${g.coat}|${g.hue}|${g.shiny}|${s}`
      if (key === last) return
      last = key
      ctx.clearRect(0, 0, box.w, box.h)
      ctx.imageSmoothingEnabled = false
      const base = box.h - UNDER * k
      const x = Math.round((box.w - 32 * s) / 2)
      ctx.globalAlpha = 0.2
      ctx.drawImage(shadow, Math.round(box.w / 2 - 8 * s), base - 5 * s, 16 * s, 8 * s)
      ctx.globalAlpha = 1
      const sprite = paintFollower(sheet, index, g)
      if (flip) {
        ctx.save()
        ctx.translate(x + 32 * s, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(sprite, 0, base - (feet + 1) * s, 32 * s, 32 * s)
        ctx.restore()
      } else ctx.drawImage(sprite, x, base - (feet + 1) * s, 32 * s, 32 * s)
    }

    draw()
    if (!item) return
    const off = item.offset.on('change', draw)
    const vel = item.velocity.on('change', draw)
    return () => {
      off()
      vel()
    }
  }, [sheet, shadow, item, k, box.w, box.h, genes, pxPerPercent, phase, forward])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`px block ${className ?? ''}`}
      style={{ width: box.w / dpr, height: box.h / dpr }}
    />
  )
}
