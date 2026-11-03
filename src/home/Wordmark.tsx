import { useCallback, useEffect, useRef, useState } from 'react'
import { blendWhite, drawHatch, GBA_HZ, hatchAt, HATCH_REVEAL, loadEggArt, type EggArt } from './hatch'
import { frameFor, loadFollower, paintFollower, type FollowerSheet } from '../lib/follower'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   The wordmark, and the egg that is its mark.

   frame's wordmark fills its drawn frame with the plates running past
   on the belts when you hover it: the product's promise performed by
   its own logo. This one hatches. Hover it (or tap it) and the egg runs
   Emerald's own hatch, frame for frame from egg_hatch.c -- three shakes,
   two cracks, shards, the fade to white -- and an Eevee comes out with
   the game's Emerge scale and stands there treading the ground, the
   same follower that walks on the arcs around it.

   The three long pauses between shakes (30 frames each in the game,
   and 51 before the flash) are run at a third of the pace here: a logo
   gets less of your patience than a cutscene does. Every frame that
   moves is the game's own.
------------------------------------------------------------------ */

/* [first game frame, last, speed]: the hatch with its waits shortened */
const SEGMENTS: [number, number, number][] = [
  [53, 74, 1],
  [74, 104, 3],
  [104, 125, 1],
  [125, 156, 3],
  [156, 194, 1],
  [194, 245, 3],
  [245, HATCH_REVEAL, 1],
]
const PLAY_FRAMES = SEGMENTS.reduce((a, [s, e, v]) => a + (e - s) / v, 0)

function sceneFrame(t: number): number {
  for (const [s, e, v] of SEGMENTS) {
    const len = (e - s) / v
    if (t < len) return s + t * v
    t -= len
  }
  return HATCH_REVEAL
}

/* The canvas is wider than the egg so the shards have room to fly; the
   egg itself (24x24 game pixels inside its 32x32 cell) sits in the slot. */
const W = 96
const H = 72
const ORIGIN: [number, number] = [W / 2, 46]
const SLOT = 24

export function Wordmark({ eggScale = 3 }: { eggScale?: number }) {
  const dpr = useDpr()
  const k = deviceScale(eggScale, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const [assets, setAssets] = useState<{ art: EggArt; sheet: FollowerSheet } | null>(null)
  const run = useRef<{ start: number; hover: boolean; done: number } | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    let alive = true
    Promise.all([loadEggArt(), loadFollower()]).then(([art, sheet]) => alive && setAssets({ art, sheet }))
    return () => {
      alive = false
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const paint = useCallback(
    (now: number) => {
      const cv = ref.current
      if (!cv || !assets) return
      const ctx = cv.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      const r = run.current
      const t = r ? ((now - r.start) / 1000) * GBA_HZ : -1
      const f = r ? (t < PLAY_FRAMES ? sceneFrame(t) : HATCH_REVEAL) : 0
      const s = hatchAt(r ? f : 0)
      if (!r) s.eggX = 0
      const after = r ? t - PLAY_FRAMES : -1
      drawHatch(ctx, assets.art, s, ORIGIN, (c, x, y, scale) => {
        // the hatchling treads the ground facing you: sAnim_GoSouth2F, six game frames a cell
        const { index } = frameFor('south', after > 0 ? after : null)
        const sp = paintFollower(assets.sheet, index, { coat: 0, hue: 0 })
        // feet where the egg's base was once it has risen (mon y 65 + 22 = the egg's bottom row, 87)
        const d = 32 * scale
        c.drawImage(sp, Math.round(x - d / 2), Math.round(y + 22 - 30 * scale), d, d)
      })
      blendWhite(ctx, s.obj)
    },
    [assets, k],
  )

  useEffect(() => {
    if (!assets) return
    const cv = ref.current!
    cv.width = W * k
    cv.height = H * k
    paint(performance.now())
  }, [assets, k, paint])

  const loop = useCallback(() => {
    const now = performance.now()
    paint(now)
    const r = run.current
    if (!r) return
    const t = ((now - r.start) / 1000) * GBA_HZ
    // after the hatch, the Eevee stays while you're here and a moment after you leave
    if (t > PLAY_FRAMES && !r.hover) {
      r.done ||= now
      if (now - r.done > 900) {
        run.current = null
        paint(now)
        return
      }
    }
    raf.current = requestAnimationFrame(loop)
  }, [paint])

  const start = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (run.current) return void (run.current.hover = true)
    run.current = { start: performance.now(), hover: true, done: 0 }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }
  const leave = () => {
    if (run.current) run.current.hover = false
  }

  const slot = cssPx(SLOT, k, dpr)
  return (
    <span className="wordmark" onPointerEnter={start} onPointerLeave={leave} onClick={start}>
      <span className="wordmark__egg" style={{ width: slot, height: slot }} aria-hidden="true">
        <canvas
          ref={ref}
          className="px"
          style={{
            width: cssPx(W, k, dpr),
            height: cssPx(H, k, dpr),
            left: -cssPx(ORIGIN[0] - SLOT / 2, k, dpr),
            top: -cssPx(ORIGIN[1] - SLOT / 2, k, dpr),
          }}
        />
      </span>
      <span className="wordmark__word">Emerald Evolved</span>
    </span>
  )
}
