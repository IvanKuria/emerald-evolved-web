import { useEffect, useRef, useState } from 'react'
import { drawText, loadFont, measure, type GameFont } from '../lib/gamefont'
import { cssPx, deviceScale, useDpr } from '../lib/pixels'

/* ------------------------------------------------------------------
   A menu the way Emerald draws one: the standard window frame
   (graphics/text_window/1.png, the default frame type, nine 8x8 tiles),
   one 16-pixel row per choice in the game's font, and the ▶ glyph
   (charmap 0xEF) beside the one that's selected, as the start menu
   does it. Hover or arrow keys move the ▶; click, Enter or A picks.

   The rows are real buttons laid over the canvas, so it is a menu to a
   screen reader and to the keyboard, not a picture of one.
------------------------------------------------------------------ */

export interface MenuItem {
  label: string
  onSelect: () => void
}

const ROW = 16
const PAD = 8 // the frame's tiles
const CURSOR = 8 // ▶ is 6 wide in the font, plus a pixel of air each side

let frame: Promise<HTMLImageElement> | null = null
const loadFrame = () =>
  (frame ??= new Promise((ok) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.src = '/game/window_frame.png'
  }))

export function GameMenu({ items, scale = 3, label }: { items: MenuItem[]; scale?: number; label: string }) {
  const dpr = useDpr()
  const k = deviceScale(scale, dpr)
  const ref = useRef<HTMLCanvasElement>(null)
  const [font, setFont] = useState<GameFont | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [at, setAt] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([loadFont(), loadFrame()]).then(([f, i]) => alive && (setFont(f), setImg(i)))
    return () => {
      alive = false
    }
  }, [])

  const textW = font ? Math.max(...items.map((it) => measure(font, it.label))) : 96
  const W = PAD * 2 + CURSOR + textW + 6
  const H = PAD * 2 + items.length * ROW

  useEffect(() => {
    const cv = ref.current
    if (!cv || !font || !img) return
    cv.width = W * k
    cv.height = H * k
    const ctx = cv.getContext('2d')!
    ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.imageSmoothingEnabled = false
    // nine-slice: corners as they are, edges and middle repeated tile by tile, never stretched
    const t = (sx: number, sy: number, dx: number, dy: number, w = 8, h = 8) => ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h)
    for (let y = PAD; y < H - PAD; y += 8)
      for (let x = PAD; x < W - PAD; x += 8) t(8, 8, x, y, Math.min(8, W - PAD - x), Math.min(8, H - PAD - y))
    for (let x = PAD; x < W - PAD; x += 8) {
      const w = Math.min(8, W - PAD - x)
      t(8, 0, x, 0, w)
      t(8, 16, x, H - PAD, w)
    }
    for (let y = PAD; y < H - PAD; y += 8) {
      const h = Math.min(8, H - PAD - y)
      t(0, 8, 0, y, 8, h)
      t(16, 8, W - PAD, y, 8, h)
    }
    t(0, 0, 0, 0)
    t(16, 0, W - PAD, 0)
    t(0, 16, 0, H - PAD)
    t(16, 16, W - PAD, H - PAD)
    items.forEach((it, i) => {
      const y = PAD + i * ROW - 1
      if (i === at) drawText(ctx, font, '▶', PAD, y)
      drawText(ctx, font, it.label, PAD + CURSOR, y)
    })
  }, [font, img, items, at, W, H, k])

  const move = (d: number) => {
    const n = (at + d + items.length) % items.length
    setAt(n)
    buttons.current[n]?.focus()
  }

  const u = cssPx(1, k, dpr)
  return (
    <div className="game-menu" role="menu" aria-label={label} style={{ width: W * u, height: H * u }}>
      <canvas ref={ref} className="px block" style={{ width: W * u, height: H * u }} aria-hidden="true" />
      {items.map((it, i) => (
        <button
          key={it.label}
          ref={(el) => void (buttons.current[i] = el)}
          type="button"
          role="menuitem"
          className="game-menu__row"
          style={{ left: PAD * u, top: (PAD + i * ROW) * u, width: (W - PAD * 2) * u, height: ROW * u }}
          onPointerEnter={() => setAt(i)}
          onFocus={() => setAt(i)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
            if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
          }}
          onClick={it.onSelect}
        >
          <span className="sr-only">{it.label}</span>
        </button>
      ))}
    </div>
  )
}
