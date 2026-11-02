import { useEffect, useRef } from 'react'
import { loadEevee, spriteFor, SHADOW } from '../lib/sprites'

/* One Eevee with given genes, at a whole-number scale, with the house
   drop shadow. Used wherever the page talks about one creature rather
   than a population. */

export function Creature({
  coat,
  mane = 0,
  scale = 2,
  frame = 0,
  className = '',
  label,
  fluid = false,
}: {
  coat: number
  mane?: number
  scale?: number
  frame?: number
  className?: string
  label?: string
  /** fill the parent's width instead of a fixed pixel size */
  fluid?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    loadEevee().then((s) => {
      const cv = ref.current
      if (!alive || !cv) return
      const spr = spriteFor(s, coat, mane)
      const dpr = Math.min(2, devicePixelRatio || 1)
      const size = 64 * scale
      const pad = Math.round(size * 0.22)
      cv.width = (size + pad) * dpr
      cv.height = (size + pad) * dpr
      const ctx = cv.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const k = size / 64
      ctx.globalAlpha = SHADOW.alpha
      ctx.drawImage(spr.shadow, SHADOW.dx * size - 12 * k, SHADOW.dy * size - 12 * k, (spr.shadow.width * k) / 4, (spr.shadow.height * k) / 4)
      ctx.globalAlpha = 1
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(spr.frames[frame], 0, 0, size, size)
    })
    return () => {
      alive = false
    }
  }, [coat, mane, scale, frame])
  const size = 64 * scale
  const pad = Math.round(size * 0.22)
  return (
    <canvas
      ref={ref}
      className={className}
      style={
        fluid
          ? { width: '122%', height: 'auto', aspectRatio: '1', marginRight: '-22%', marginBottom: '-22%', display: 'block' }
          : { width: size + pad, height: size + pad, marginRight: -pad, marginBottom: -pad }
      }
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
