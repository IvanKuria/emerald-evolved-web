import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeltFrame, type BeltFrame } from '../components/PathBelt'
import { useDpr } from '../lib/pixels'
import { FOLLOWER_MAX_SCALE, feetOf, frameFor, loadFollower, loadShadow, paintFollower, type FollowerSheet, type Look } from '../lib/follower'

/* ------------------------------------------------------------------
   One Eevee walking on a belt (components/PathBelt.tsx).

   Every frame the belt tells it where it is on the path, how fast the
   belt runs, how far it has run in all (never decreasing) and which way
   to face (with hysteresis, so velocity noise never turns it round).
   Its feet change with distance, the game's ratio of six pixels to a
   frame, so a slowed belt steps slowly and a stopped one stands still.
   Its genes can depend on where it is (the lower arc evolves along it).

   The canvas is redrawn only when the frame, colors or size change.
   It never moves itself: the belt moves its box with a fractional
   transform, and the shadow is drawn in the same canvas, so the two
   travel as one. Sizes are whole device pixels per game pixel.
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
  index,
  k,
  kCss,
  genes,
  phase = 0,
}: {
  index: number
  /** device pixels per game pixel at 1.0x */
  k: number
  /** CSS pixels per game pixel, to turn distance into game pixels walked */
  kCss: number
  /** genes at a place on the path, t = 0..1 */
  genes: (t: number) => Genes
  /** game pixels, so the herd doesn't step in unison */
  phase?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [art, setArt] = useState<{ sheet: FollowerSheet; shadow: HTMLCanvasElement } | null>(null)
  const box = walkerBox(k)
  const dpr = useDpr()
  const last = useRef('')

  useEffect(() => {
    let alive = true
    Promise.all([loadFollower(), loadShadow()]).then(([sheet, shadow]) => alive && setArt({ sheet, shadow }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    cv.width = box.w
    cv.height = box.h
    last.current = ''
  }, [box.w, box.h])

  const draw = useCallback(
    (f: BeltFrame) => {
      const cv = ref.current
      if (!cv || !art) return
      const facing = f.facing > 0 ? 'east' : 'west'
      const moving = Math.abs(f.v) > 3
      const { index: frame, flip } = frameFor(facing, moving ? f.walked / kCss + phase : null)
      const g = genes(f.t)
      const s = Math.max(1, Math.round(k * Math.min(FOLLOWER_MAX_SCALE, g.scale)))
      const key = `${frame}|${flip}|${g.coat}|${g.hue}|${g.shiny}|${s}`
      if (key === last.current) return
      last.current = key
      cv.dataset.facing = facing
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, box.w, box.h)
      ctx.imageSmoothingEnabled = false
      const base = box.h - UNDER * k
      const x = Math.round((box.w - 32 * s) / 2)
      const feet = feetOf(art.sheet)
      ctx.globalAlpha = 0.2
      ctx.drawImage(art.shadow, Math.round(box.w / 2 - 8 * s), base - 5 * s, 16 * s, 8 * s)
      ctx.globalAlpha = 1
      const sprite = paintFollower(art.sheet, frame, g)
      if (flip) {
        ctx.save()
        ctx.translate(x + 32 * s, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(sprite, 0, base - (feet + 1) * s, 32 * s, 32 * s)
        ctx.restore()
      } else ctx.drawImage(sprite, x, base - (feet + 1) * s, 32 * s, 32 * s)
    },
    [art, box.w, box.h, genes, k, kCss, phase],
  )
  useBeltFrame(index, draw)

  return <canvas ref={ref} aria-hidden="true" className="px block" style={{ width: box.w / dpr, height: box.h / dpr }} />
}
