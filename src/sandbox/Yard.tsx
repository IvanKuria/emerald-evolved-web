import { useEffect, useRef, useState } from 'react'
import { drawFront, FRONT_FRAMES, loadFront, type FrontSheet } from '../lib/front'
import { drawText, loadFont, measure, type GameFont } from '../lib/gamefont'
import { GBA_HZ } from '../home/hatch'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'
import { heightCm, hueOf, scaleOf, type Mon } from './line'

/* ------------------------------------------------------------------
   The Day Care yard: the two parents of the line, side by side, as
   their front sprites at their real size (the ROM's display scale, up
   to 2.0x, nearest-neighbour like the GBA's affine unit), each with its
   HEIGHT. When a parent is replaced it plays Eevee's front animation,
   the way a Pokémon does when you look at it on the summary screen.
------------------------------------------------------------------ */

const W = 176
const H = 128
const FEET = 112

export function Yard({ mum, dad, scale = 2 }: { mum: Mon; dad: Mon; scale?: number }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const [art, setArt] = useState<{ front: FrontSheet; font: GameFont } | null>(null)
  const changed = useRef<Record<string, number>>({})
  const last = useRef<{ mum: number; dad: number }>({ mum: 0, dad: 0 })
  const parents = useRef({ mum, dad })
  parents.current = { mum, dad }

  useEffect(() => void Promise.all([loadFront(), loadFont()]).then(([front, font]) => setArt({ front, font })), [])

  // a new parent arrives with its front animation
  if (last.current.mum !== mum.id) (changed.current.mum = performance.now()), (last.current.mum = mum.id)
  if (last.current.dad !== dad.id) (changed.current.dad = performance.now()), (last.current.dad = dad.id)

  useEffect(() => {
    const cv = ref.current
    if (!cv || !art) return
    cv.width = W * k
    cv.height = H * k
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.imageSmoothingEnabled = false
      ;(['mum', 'dad'] as const).forEach((who, i) => {
        const m = parents.current[who]
        const s = Math.min(2, scaleOf(m))
        const x = i === 0 ? 50 : 126
        const f = ((now - (changed.current[who] ?? -1e9)) / 1000) * GBA_HZ
        // Eevee's feet are on row 55 of its 64x64 cell; scale pivots on the centre, so lift by that much
        drawFront(ctx, art.front, { coat: 0, hue: hueOf(m) }, x, FEET - 6 - (55 - 32) * s, f < FRONT_FRAMES ? f : null, s)
        const label = `${(heightCm(m) / 100).toFixed(2)} m`
        const tw = measure(art.font, label)
        drawText(ctx, art.font, label, Math.round(x - tw / 2 + 4), FEET - 2)
        drawText(ctx, art.font, m.female ? '♀' : '♂', Math.round(x - tw / 2 - 6), FEET - 2)
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [art, k])

  const u = cssPx(1, k, dpr)
  return <canvas ref={ref} className="px block yard" style={{ width: W * u, height: H * u }} role="img" aria-label={`The parents: a daughter ${(heightCm(mum) / 100).toFixed(2)} meters tall and a son ${(heightCm(dad) / 100).toFixed(2)} meters tall`} />
}
