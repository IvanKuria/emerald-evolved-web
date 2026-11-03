import { useEffect, useRef, useState } from 'react'
import { drawText, loadFont, measure, type GameFont } from '../lib/gamefont'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'
import { GBA_HZ } from '../home/hatch'
import { ICON_FRAME_GAME_FRAMES, loadIcon, paintIcon } from './icon'
import { heightCm, hueOf, type Mon } from './line'

/* ------------------------------------------------------------------
   The litter, laid out like a PC box: one slot per egg, each Pokémon
   as its party icon, bobbing on its two frames, with the summary's
   HEIGHT under it in the game's font and its sex in the summary's own
   blue and red. Colors come from the hack's icon recoloring.

   Eggs arrive as the party-menu egg icon, drop in, wobble and hatch
   with a white blend (BlendPalette toward white, as the hatch does);
   an egg that doesn't hatch stays an egg. The PC's hand points at
   whatever you're over, opens, and closes into a fist when you press.
   The two you keep sit on a green slot, the HP bar's own green.

   One canvas for the whole box; real buttons over each slot for the
   pointer, the keyboard and screen readers.
------------------------------------------------------------------ */

const CELL_W = 46
const CELL_H = 50
const PAD = 6
const MALE = [66, 206, 255]
const FEMALE = [255, 156, 148]

const img = (src: string) =>
  new Promise<HTMLImageElement>((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.src = src
  })

interface Art {
  font: GameFont
  egg: HTMLImageElement
  hand: HTMLImageElement
  icon: Awaited<ReturnType<typeof loadIcon>>
}
let art: Promise<Art> | null = null
const loadArt = () =>
  (art ??= Promise.all([loadFont(), img('/game/egg_icon.png'), img('/game/hand_cursor.png'), loadIcon()]).then(([font, egg, hand, icon]) => ({ font, egg, hand, icon })))

let tintLayer: HTMLCanvasElement | null = null
function tinted(ctx: CanvasRenderingContext2D, f: GameFont, text: string, x: number, y: number, rgb: number[]) {
  tintLayer ??= document.createElement('canvas')
  const w = measure(f, text) + 2
  tintLayer.width = w
  tintLayer.height = 16
  const t = tintLayer.getContext('2d')!
  drawText(t, f, text, 0, 0)
  t.globalCompositeOperation = 'source-atop'
  t.fillStyle = `rgb(${rgb.join(' ')})`
  t.fillRect(0, 0, w, 16)
  ctx.drawImage(tintLayer, x, y)
}

export function PcBox({
  litter,
  born,
  quick,
  kept,
  picking,
  onPick,
  cols,
}: {
  litter: Mon[]
  /** performance.now() when this litter was laid */
  born: number
  /** auto-breeding: no hatch animation */
  quick: boolean
  kept: number[]
  picking: boolean
  onPick: (m: Mon) => void
  cols: number
}) {
  const dpr = useDpr()
  const k = deviceScale(2, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const [a, setA] = useState<Art | null>(null)
  const [hover, setHover] = useState(-1)
  const [press, setPress] = useState(false)
  const state = useRef({ litter, born, quick, kept, hover, press, picking })
  state.current = { litter, born, quick, kept, hover, press, picking }
  const rows = Math.ceil(10 / cols)
  const W = cols * CELL_W + PAD * 2
  const H = rows * CELL_H + PAD * 2

  useEffect(() => void loadArt().then(setA), [])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !a) return
    cv.width = W * k
    cv.height = H * k
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (now: number) => {
      const st = state.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.imageSmoothingEnabled = false
      const bob = Math.floor(((now / 1000) * GBA_HZ) / ICON_FRAME_GAME_FRAMES) & 1
      for (let i = 0; i < 10; i++) {
        const x = PAD + (i % cols) * CELL_W
        const y = PAD + Math.floor(i / cols) * CELL_H
        const m = st.litter[i]
        if (!m) continue
        const keptHere = st.kept.includes(m.id)
        if (keptHere) {
          ctx.fillStyle = '#e3f5e7'
          ctx.fillRect(x + 2, y + 1, CELL_W - 4, CELL_H - 3)
          ctx.fillStyle = '#5ad684'
          ctx.fillRect(x + 2, y + 1, CELL_W - 4, 1)
          ctx.fillRect(x + 2, y + CELL_H - 3, CELL_W - 4, 1)
          ctx.fillRect(x + 2, y + 1, 1, CELL_H - 3)
          ctx.fillRect(x + CELL_W - 3, y + 1, 1, CELL_H - 3)
        }
        // the egg's own time: staggered across the box, the first litter slower so it can be watched
        const t = st.quick ? 9 : (now - st.born) / 1000 - i * 0.12
        const ex = x + (CELL_W - 14) / 2
        const ey = y + 12
        if (t < 0) continue
        const hatchAt = 0.95
        if (t < hatchAt || !m.hatched) {
          // drop in (whole pixels), then wobble like the hatch's first shake: Sin(sin, 1)
          const drop = t < 0.25 ? Math.round((1 - t / 0.25) ** 2 * -8) : 0
          const wob = t > 0.45 && t < hatchAt ? Math.round(Math.sin(t * 40)) : 0
          ctx.globalAlpha = Math.min(1, t * 6)
          ctx.drawImage(a.egg, 0, 0, 14, 15, ex + wob, ey + drop, 14, 15)
          ctx.globalAlpha = 1
          continue
        }
        // hatched: the icon, white at first and fading to its colors (the hatch's fade back from white)
        const fade = Math.max(0, 1 - (t - hatchAt) / 0.3)
        const sp = paintIcon(a.icon, bob, hueOf(m))
        ctx.drawImage(sp, x + (CELL_W - 32) / 2, y - 2)
        if (fade > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'source-atop'
          ctx.globalAlpha = fade
          ctx.fillStyle = '#fff'
          ctx.fillRect(x, y - 2, CELL_W, 32)
          ctx.restore()
        }
        if (fade < 0.5) {
          const cm = heightCm(m)
          const label = `${(cm / 100).toFixed(2)}m`
          const tw = measure(a.font, label) + 8
          const tx = Math.round(x + (CELL_W - tw) / 2)
          tinted(ctx, a.font, m.female ? '♀' : '♂', tx, y + 28, m.female ? FEMALE : MALE)
          drawText(ctx, a.font, label, tx + 8, y + 28)
        }
      }
      // the PC's hand over the slot you're pointing at: bouncing, open, or a fist on the press
      if (st.picking && st.hover >= 0) {
        const x = PAD + (st.hover % cols) * CELL_W + CELL_W / 2 - 4
        const y = PAD + Math.floor(st.hover / cols) * CELL_H - 18
        const f = st.press ? 3 : Math.floor(((now / 1000) * GBA_HZ) / 30) & 1
        ctx.drawImage(a.hand, 0, f * 32, 32, 32, x, y + (f === 1 ? 1 : 0), 32, 32)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [a, k, W, H, cols])

  const u = cssPx(1, k, dpr)
  return (
    <div className="pcbox game-window" style={{ width: W * u + 32 }}>
      <div className="relative" style={{ width: W * u, height: H * u }}>
        <canvas ref={ref} className="px block" style={{ width: W * u, height: H * u }} aria-hidden="true" />
        {litter.map((m, i) => {
          const ok = picking && m.hatched
          return (
            <button
              key={m.id}
              type="button"
              className="pcbox__slot"
              disabled={!ok}
              aria-pressed={kept.includes(m.id)}
              aria-label={m.hatched ? `${m.female ? 'Daughter' : 'Son'}, ${(heightCm(m) / 100).toFixed(2)} meters tall` : 'An egg that didn’t hatch'}
              style={{ left: (PAD + (i % cols) * CELL_W) * u, top: (PAD + Math.floor(i / cols) * CELL_H) * u, width: CELL_W * u, height: CELL_H * u }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => (setHover(-1), setPress(false))}
              onFocus={() => setHover(i)}
              onPointerDown={() => setPress(true)}
              onPointerUp={() => setPress(false)}
              onClick={() => ok && onPick(m)}
            />
          )
        })}
      </div>
    </div>
  )
}

