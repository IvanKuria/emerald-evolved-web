import { useEffect, useRef, useState } from 'react'
import { shadowOf, SHADOW } from '../lib/sprites'
import { bounds } from '../registry/sprite'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* Any 64x64 game sprite (already painted) at a whole number of screen
   pixels per game pixel, laid out by its own opaque pixels, with the
   house drop shadow falling down-right past its box. */

export function PixelSprite({ sprite, scale = 3, label }: { sprite: HTMLCanvasElement | null; scale?: number; label: string }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const [b, setB] = useState({ x: 8, y: 8, w: 48, h: 48 })

  useEffect(() => {
    const cv = ref.current
    if (!sprite || !cv) return
    const bb = bounds(sprite)
    setB(bb)
    const over = 16
    cv.width = (bb.w + over + 4) * k
    cv.height = (bb.h + over + 4) * k
    const ctx = cv.getContext('2d')!
    const ox = -(bb.x - 4) * k
    const oy = -(bb.y - 4) * k
    const sh = shadowOf(sprite)
    ctx.globalAlpha = SHADOW.alpha
    ctx.drawImage(sh, ox + SHADOW.dx * 64 * k - SHADOW.pad * k, oy + SHADOW.dy * 64 * k - SHADOW.pad * k, (sh.width * k) / 4, (sh.height * k) / 4)
    ctx.globalAlpha = 1
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sprite, ox, oy, 64 * k, 64 * k)
  }, [sprite, k])

  return (
    <span className="relative inline-block align-bottom" role="img" aria-label={label} style={{ width: cssPx(b.w, k, dpr), height: cssPx(b.h, k, dpr) }}>
      <canvas
        ref={ref}
        className="pointer-events-none absolute"
        style={{ left: -cssPx(4, k, dpr), top: -cssPx(4, k, dpr), width: cssPx(b.w + 20, k, dpr), height: cssPx(b.h + 20, k, dpr) }}
      />
    </span>
  )
}
